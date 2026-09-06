import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { isOfficialCommitteeEmail, normalizeEmail, OFFICIAL_EMAIL_DOMAIN } from '../constants/officialEmails';
import { db, withTransaction } from '../db';
import authMiddleware, { adminOnly } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import { signUserToken, verifyUserToken } from '../utils/jwt';
import { PostgresStore } from '@acpr/rate-limit-postgresql';

const dbConfig = {
  connectionString: process.env.DATABASE_URL?.replace(/([?&])sslmode=[^&]*&?/g, '$1').replace(/[?&]$/, '') || '',
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
};

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    message: { error: 'Too many login attempts, please try again after 10 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store: new PostgresStore(dbConfig, 'rate_limits_login'),
});

const registerLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 25,
    message: { error: 'Too many registration attempts, please try again after 10 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresStore(dbConfig, 'rate_limits_register'),
});

const passwordResetLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 3,
    message: { error: 'Too many password reset requests, please try again after 30 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresStore(dbConfig, 'rate_limits_reset'),
});

// Admin Route
router.post('/register', authMiddleware, adminOnly, registerLimiter, async (req, res) => {
    const { email, password, clubName, groupCategory, organizationType, userId: providedUserId } = req.body;

    if (providedUserId) {
        return res.status(400).json({ error: 'Providing a userId is not allowed during registration' });
    }

    if (!email || !password || !clubName || !groupCategory) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
    }

    if (!isOfficialCommitteeEmail(email)) {
        return res.status(400).json({
            error: `Club accounts must use an official committee email ending with ${OFFICIAL_EMAIL_DOMAIN}`,
        });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
        const userId = randomUUID();
        const hashedPassword = await bcrypt.hash(password, 10);

        await withTransaction(async (client) => {
            await client.query(`
                INSERT INTO auth.users (id, email, encrypted_password)
                VALUES ($1, $2, $3)
            `, [userId, normalizedEmail, hashedPassword]);

            await client.query(`
                INSERT INTO profiles (id, email, role, full_name)
                VALUES ($1, $2, 'club', $3)
            `, [userId, normalizedEmail, clubName]);

            await client.query(`
                INSERT INTO clubs (name, email, group_category, organization_type)
                VALUES ($1, $2, $3, $4)
            `, [clubName, normalizedEmail, groupCategory, organizationType || 'club']);
        });

        return res.status(201).json({ message: 'Registration successful', userId });

    } catch (err: any) {
        console.error('Registration error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }
        return res.status(400).json({ error: 'Registration failed' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        const normalizedEmail = normalizeEmail(email);
        const { rows } = await db.query(
            'SELECT id, encrypted_password FROM auth.users WHERE LOWER(email) = $1',
            [normalizedEmail]
        );
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.encrypted_password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signUserToken(user.id);
        res.cookie('jwt_token', token, cookieOptions);

        return res.json({ message: 'Logged in successfully' });
    } catch (err: any) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('jwt_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
    });
    return res.json({ message: 'Logged out successfully' });
});

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const genericMessage = 'If an account exists for this email, a 6-digit OTP has been sent.';

    try {
        const normalizedEmail = normalizeEmail(email);
        const { rows } = await db.query(
            'SELECT id, email FROM auth.users WHERE LOWER(email) = $1',
            [normalizedEmail]
        );
        if (rows.length === 0) {
            return res.json({ message: genericMessage });
        }

        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await db.query(
            'UPDATE auth.users SET reset_otp = $1, reset_otp_expires_at = $2 WHERE id = $3',
            [hashedOtp, expiresAt, rows[0].id]
        );

        const emailResult = await sendPasswordResetEmail(rows[0].email, otp);

        if (!emailResult.sent) {
            console.log(`\n======================================================`);
            console.log(`[DEV ONLY] Password Reset Requested`);
            console.log(`Email: ${rows[0].email}`);
            console.log(`OTP: ${otp}`);
            console.log(`Reason: Email is not configured or failed to send (${emailResult.error || 'not configured'}).`);
            console.log(`======================================================\n`);
        }

        return res.json({ message: genericMessage });

    } catch (err: any) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/verify-otp', loginLimiter, async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    try {
        const { rows } = await db.query(
            'SELECT reset_otp, reset_otp_expires_at FROM auth.users WHERE LOWER(email) = $1',
            [normalizeEmail(email)]
        );
        const user = rows[0];

        if (!user || !user.reset_otp || !user.reset_otp_expires_at) {
            return res.status(400).json({ error: 'No active password reset request found' });
        }

        if (new Date() > new Date(user.reset_otp_expires_at)) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        const isMatch = await bcrypt.compare(otp, user.reset_otp);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        return res.json({ message: 'OTP verified successfully' });
    } catch (err: any) {
        console.error('Verify OTP error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/reset-password', loginLimiter, async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
    }

    try {
        const { rows } = await db.query(
            'SELECT id, reset_otp, reset_otp_expires_at FROM auth.users WHERE LOWER(email) = $1',
            [normalizeEmail(email)]
        );
        const user = rows[0];

        if (!user || !user.reset_otp || !user.reset_otp_expires_at) {
            return res.status(400).json({ error: 'No active password reset request found' });
        }

        if (new Date() > new Date(user.reset_otp_expires_at)) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        const isMatch = await bcrypt.compare(otp, user.reset_otp);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE auth.users SET encrypted_password = $1, reset_otp = NULL, reset_otp_expires_at = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        const token = signUserToken(user.id);
        res.cookie('jwt_token', token, cookieOptions);

        return res.json({ message: 'Password reset successfully. You are now logged in.' });
    } catch (err: any) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Protected Routes

router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = req.cookies?.jwt_token || (authHeader.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null);

        if (!token) {
            return res.json(null); // Soft fail for better UX, no 401 in console
        }

        let decoded;
        try {
            decoded = verifyUserToken(token);
        } catch {
            return res.json(null); // Invalid/expired token
        }

        const userId = decoded.sub;
        if (!userId) {
            return res.json(null);
        }

        // 1. Fetch Profile
        let profileRes = await db.query('SELECT * FROM profiles WHERE id = $1', [userId]);
        let profile = profileRes.rows[0];

        // If profile doesn't exist (e.g. first login via legacy OAuth), auto-create it
        if (!profile) {
            // Get user details directly from auth.users table (removed raw_user_meta_data)
            const authUserRes = await db.query('SELECT email FROM auth.users WHERE id = $1', [userId]);
            const authUser = authUserRes.rows[0];

            if (!authUser) {
                return res.status(404).json({ error: 'User not found in auth' });
            }

            const email = authUser.email || '';
            const fullName = email.split('@')[0] || 'New Club';

            // Upsert the profile
            await db.query(`
                INSERT INTO profiles (id, email, role, full_name)
                VALUES ($1, $2, 'club', $3)
                ON CONFLICT (id) DO UPDATE 
                SET email = EXCLUDED.email, 
                    full_name = EXCLUDED.full_name
            `, [userId, email, fullName]);

            // Auto-create club entry if not already there
            const existingClub = await db.query('SELECT id FROM clubs WHERE email = $1', [email]);

            if (existingClub.rows.length === 0) {
                await db.query(`
                    INSERT INTO clubs (name, email, group_category)
                    VALUES ($1, $2, 'C')
                `, [fullName, email]);
            }

            // Re-fetch the profile
            profileRes = await db.query('SELECT * FROM profiles WHERE id = $1', [userId]);
            profile = profileRes.rows[0];

            if (!profile) {
                return res.status(500).json({ error: 'Profile created but could not be fetched' });
            }
        }

        let clubData = null;

        // 2. If Club, fetch Club details
        if (profile.role === 'club') {
            const clubRes = await db.query('SELECT id, name, group_category, logo_url, logo_bg, organization_type FROM clubs WHERE email = $1 LIMIT 1', [profile.email]);
            clubData = clubRes.rows[0];
        }

        // 3. Construct Response
        const responseData = {
            id: profile.id,
            email: profile.email,
            name: clubData ? clubData.name : profile.full_name,
            role: profile.role,
            group: clubData ? clubData.group_category : undefined,
            clubId: clubData ? clubData.id : undefined,
            logoUrl: clubData ? clubData.logo_url : null,
            logoBg: clubData ? clubData.logo_bg : null,
            organization_type: clubData ? clubData.organization_type : undefined,
        };

        return res.json(responseData);

    } catch (err) {
        console.error('Profile endpoint error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing current or new password' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
    }

    try {
        const { rows } = await db.query('SELECT encrypted_password FROM auth.users WHERE id = $1', [userId]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.encrypted_password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE auth.users SET encrypted_password = $1 WHERE id = $2', [hashedNewPassword, userId]);

        return res.json({ message: 'Password updated successfully' });
    } catch (err: any) {
        console.error('Change password error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;