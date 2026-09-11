import { motion } from 'framer-motion';
import {
    Building2,
    ExternalLink,
    FileText,
    Globe,
    Linkedin,
    ListChecks,
    Mail,
    Network,
    Phone,
    Shield,
    Users
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GdgFooterCredit } from '../components/GdgFooterCredit';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { apiRequest } from '../lib/api';

let preloadedAboutData: { clubs: Club[], members: Member[], stats: Record<string, number>, settings: Record<string, string> } | null = null;
let preloadAboutPromise: Promise<any> | null = null;

export const preloadAboutSBG = () => {
    if (preloadedAboutData || preloadAboutPromise) return preloadAboutPromise;
    preloadAboutPromise = Promise.all([
        apiRequest<Club[]>('/api/clubs'),
        apiRequest<Member[]>('/api/club-members/public'),
        apiRequest<Record<string, number>>('/api/clubs/stats'),
        apiRequest<Record<string, string>>('/api/settings').catch(() => ({} as Record<string, string>)),
    ]).then(([clubsData, membersData, statsData, settingsData]) => {
        preloadedAboutData = { clubs: clubsData, members: membersData, stats: statsData, settings: settingsData };
        return preloadedAboutData;
    });
    return preloadAboutPromise;
};

// Start fetching the data immediately as soon as the JS bundle loads!
preloadAboutSBG();

interface Club {
    id: string;
    name: string;
    email: string;
    description?: string;
    organization_type: string;
    logo_url?: string;
    instagram_url?: string;
    linkedin_url?: string;
    youtube_url?: string;
    website_url?: string;
}

interface Member {
    id: string;
    club_id: string;
    club_name: string;
    full_name: string;
    roll_number: string | null;
    designation: string;
    phone: string | null;
    email: string | null;
    organization_type: string;
}

const SBG_DESCRIPTION = `The students of DAU (Formerly DAU) have constituted a self-governing democratic organization called DAU Student Body Government, to achieve the following:`;

const SBG_OBJECTIVES = [
    'Monitoring and regulation of all student activities.',
    'Ensuring justice and equality in all aspects of student life.',
    'Enhancing the overall development of all students.',
];

const DESIGNATION_ORDER: Record<string, number> = {
    'Convener': 1,
    'Dy. Convener': 2,
    'Treasurer': 3,
    'Secretary': 4,
};

const DESIGNATION_COLORS: Record<string, string> = {
    'Convener': 'bg-brand/10 text-brand border-brand/20',
    'Dy. Convener': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    'Treasurer': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Secretary': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

/** Reusable dashboard panel — mirrors the "panel-heading / panel-body" pattern
 *  from the legacy SBG dashboard: a labeled header bar over left-aligned content. */
const Panel: React.FC<{
    icon: React.ReactNode;
    title: string;
    action?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}> = ({ icon, title, action, className = '', children }) => (
    <div className={`rounded-2xl border border-borderSoft/60 bg-card/80 backdrop-blur-sm ${className.includes('overflow-visible') ? 'overflow-visible' : 'overflow-hidden'} ${className}`}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-borderSoft/50 bg-hoverSoft/20">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    {icon}
                </span>
                <h3 className="font-bold text-textPrimary text-sm sm:text-base truncate">{title}</h3>
            </div>
            {action}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const MemberAvatar = ({ member, settings }: { member: Member; settings?: Record<string, string> }) => {
    const expectedKey = member.designation.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const dbPhoto = settings?.[`sbg_photo_${expectedKey}`];

    const [imgError, setImgError] = useState(false);

    if (!dbPhoto || imgError) {
        return (
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-brand/20 to-brand/5 border border-borderSoft/60 flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-sm font-bold text-brand">{getInitials(member.full_name)}</span>
            </div>
        );
    }

    return (
        <img
            src={dbPhoto}
            alt={member.full_name}
            onError={() => setImgError(true)}
            className="h-11 w-11 rounded-full object-cover border border-borderSoft/60 shrink-0 bg-card shadow-sm"
        />
    );
};

const AboutSBG: React.FC = () => {
    const navigate = useNavigate();
    const [ecModalOpen, setEcModalOpen] = useState(false);
    const [clubs, setClubs] = useState<Club[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({ club: 0, committee: 0, organisation: 0 });
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            if (preloadedAboutData) {
                setClubs(preloadedAboutData.clubs);
                setMembers(preloadedAboutData.members);
                setStats(preloadedAboutData.stats);
                setSettings(preloadedAboutData.settings);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const data = await preloadAboutSBG();
                if (mounted && data) {
                    setClubs(data.clubs);
                    setMembers(data.members);
                    setStats(data.stats);
                    setSettings(data.settings);
                }
            } catch (err) {
                console.error('Failed to fetch about data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchData();
        return () => { mounted = false; };
    }, []);

    const sbgClub = useMemo(() => clubs.find(c => c.organization_type === 'other' && c.name.toLowerCase().includes('student body government')), [clubs]);
    const ecClub = useMemo(() => clubs.find(c => c.organization_type === 'other' && c.name.toLowerCase().includes('election commission')), [clubs]);

    const sbgMembers = useMemo(() => {
        if (!sbgClub) return [];
        return members
            .filter(m => m.club_id === sbgClub.id)
            .sort((a, b) => (DESIGNATION_ORDER[a.designation] || 99) - (DESIGNATION_ORDER[b.designation] || 99));
    }, [members, sbgClub]);

    const ecMembers = useMemo(() => {
        if (!ecClub) return [];
        return members
            .filter(m => m.club_id === ecClub.id)
            .sort((a, b) => (DESIGNATION_ORDER[a.designation] || 99) - (DESIGNATION_ORDER[b.designation] || 99));
    }, [members, ecClub]);

    const uniqueStudentCounts = useMemo(() => {
        const counts: Record<string, number> = { club: 0, committee: 0, organisation: 0, total: 0 };
        const allUniqueIds = new Set<string>();

        (['club', 'committee', 'organisation'] as const).forEach(tab => {
            const tabClubs = clubs.filter(c => c.organization_type === tab).map(c => c.id);
            const tabMembers = members.filter(m => tabClubs.includes(m.club_id));
            const uniqueIds = new Set(tabMembers.map(m => m.roll_number?.toLowerCase().trim() || m.id));
            counts[tab] = uniqueIds.size;

            // Add to total
            tabMembers.forEach(m => allUniqueIds.add(m.roll_number?.toLowerCase().trim() || m.id));
        });
        counts.total = allUniqueIds.size;
        return counts;
    }, [clubs, members]);

    // The 4th card will represent total unique members across all organizations
    const totalMembers = uniqueStudentCounts.total;

    const initials = (name: string) => getInitials(name);

    return (
        <div className="min-h-dvh bg-bgMain">

            <main className="max-w-7xl 3xl:max-w-[1800px] 4k:max-w-[2400px] uhd:max-w-[3200px] mx-auto px-4 sm:px-6 3xl:px-12 py-8 sm:py-10 3xl:py-16">

                {/* ====== Page title bar (left-aligned, dashboard style) ====== */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-row items-center gap-4 mb-8"
                >
                    <div className="h-14 w-14 rounded-2xl bg-card border border-borderSoft/60 shadow-sm flex items-center justify-center shrink-0">
                        <img src="/sbg_logo.webp" alt="SBG Logo" width="36" height="36" className="w-9 h-9 object-contain" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-brand text-xs font-semibold uppercase tracking-wider mb-1">
                            <Shield size={13} />
                            <span>Student Body Government</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">About SBG</h1>
                    </div>
                </motion.div>

                {/* ====== Stats row ====== */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Clubs', value: stats.club, members: uniqueStudentCounts.club, icon: Users, accent: 'text-blue-500', bar: 'bg-blue-500' },
                        { label: 'Committees', value: stats.committee, members: uniqueStudentCounts.committee, icon: Shield, accent: 'text-emerald-500', bar: 'bg-emerald-500' },
                        { label: 'Organisations', value: stats.organisation, members: uniqueStudentCounts.organisation, icon: Building2, accent: 'text-amber-500', bar: 'bg-amber-500' },
                        { label: 'Total Members', value: totalMembers, icon: Globe, accent: 'text-brand', bar: 'bg-brand' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="relative rounded-2xl border border-borderSoft/60 bg-card/80 p-4 sm:p-5 flex items-center justify-between gap-3 overflow-hidden"
                        >
                            <span className={`absolute inset-y-0 left-0 w-1 ${stat.bar}`} />
                            <div className="min-w-0">
                                <p className="text-2xl sm:text-3xl font-extrabold text-textPrimary leading-none">{loading ? '–' : stat.value}</p>
                                <p className="text-xs sm:text-sm text-textMuted mt-1.5 font-medium truncate">{stat.label}</p>
                            </div>
                            <stat.icon size={26} className={`${stat.accent} shrink-0 opacity-80`} />
                        </motion.div>
                    ))}
                </div>

                {/* ====== Main dashboard grid ====== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* ---- Left column (wider) ---- */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        <Panel icon={<Shield size={16} />} title="Student Body Government Vision">
                            <p className="text-sm text-textSecondary leading-relaxed mb-4">{SBG_DESCRIPTION}</p>
                            <ul className="space-y-2.5">
                                {SBG_OBJECTIVES.map((obj, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-textSecondary">
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                                        <span>{obj}</span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>

                        <Panel icon={<Network size={16} />} title="Organizational Hierarchy" className="overflow-visible">
                            <div className="relative">
                                {/* Vertical connection line */}
                                <div className="absolute left-[33px] top-[45px] bottom-[30px] w-0.5 bg-gradient-to-b from-brand/40 via-borderSoft/80 to-borderSoft/80 rounded-full z-0" />

                                <div className="flex flex-col gap-4 relative z-10">
                                    {/* Dean */}
                                    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-card px-4 py-3 shadow-sm relative z-10">
                                        <span className="h-9 w-9 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                                            <Shield size={16} />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-textPrimary text-sm">Dean of Students</p>
                                            <p className="text-xs text-textMuted">DAU · Reporting authority</p>
                                        </div>
                                    </div>

                                    {/* SBG */}
                                    <div className="relative pl-[60px]">
                                        {/* Horizontal line with SVG Arrow */}
                                        <div className="absolute left-[34px] top-1/2 -translate-y-1/2 w-[26px] flex items-center justify-end z-0 text-borderSoft/80">
                                            <div className="h-0.5 w-full bg-borderSoft/80"></div>
                                            <svg className="w-3.5 h-3.5 -ml-1 text-borderSoft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-xl border border-borderSoft/60 bg-card hover:bg-hoverSoft/20 transition-all px-4 py-3 shadow-sm relative z-10">
                                            <span className="h-9 w-9 rounded-lg bg-card border border-brand/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                <img src={sbgClub?.logo_url || "/sbg_logo.webp"} alt="SBG" width="36" height="36" className="w-full h-full" loading="lazy" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-textPrimary text-sm">Student Body Government (SBG)</p>
                                                <p className="text-xs text-textMuted">{sbgMembers.length} core members</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EC */}
                                    <div className="relative pl-[60px]">
                                        {/* Horizontal line with SVG Arrow */}
                                        <div className="absolute left-[34px] top-1/2 -translate-y-1/2 w-[26px] flex items-center justify-end z-0 text-borderSoft/80">
                                            <div className="h-0.5 w-full bg-borderSoft/80"></div>
                                            <svg className="w-3.5 h-3.5 -ml-1 text-borderSoft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <button
                                            onClick={() => setEcModalOpen(true)}
                                            className="flex items-center gap-3 rounded-xl border border-borderSoft/60 bg-card hover:bg-hoverSoft/40 hover:border-violet-500/30 transition-all px-4 py-3 text-left w-full cursor-pointer shadow-sm relative z-10"
                                        >
                                            {ecClub?.logo_url ? (
                                                <span className="h-9 w-9 rounded-lg bg-card border border-brand/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                    <img src={ecClub.logo_url} alt="EC" width="36" height="36" className="w-full h-full object-cover" loading="lazy" />
                                                </span>
                                            ) : (
                                                <span className="h-9 w-9 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                                                    <Building2 size={16} />
                                                </span>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-textPrimary text-sm">Election Commission (EC)</p>
                                                <p className="text-xs text-textMuted">{ecMembers.length} commissioners</p>
                                            </div>
                                            <ExternalLink size={14} className="text-textMuted shrink-0 opacity-50" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        <Panel icon={<Users size={16} />} title={`Core SBG Members`}>
                            {sbgMembers.length === 0 && !loading ? (
                                <p className="text-sm text-textMuted">No SBG members found. Members are managed by the admin.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {sbgMembers.map((member, i) => (
                                        <motion.div
                                            key={member.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex items-center gap-3 rounded-xl border border-borderSoft/50 bg-hoverSoft/10 hover:bg-hoverSoft/30 hover:border-brand/30 transition-colors p-3"
                                        >
                                            <MemberAvatar member={member} settings={settings} />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-textPrimary text-sm truncate">{member.full_name}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${DESIGNATION_COLORS[member.designation] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                                        {member.designation}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {member.email && (
                                                    <a href={`mailto:${member.email}`} className="p-2 rounded-lg text-textMuted hover:text-brand hover:bg-brand/10 transition-colors" aria-label={`Email ${member.full_name}`}>
                                                        <Mail size={14} />
                                                    </a>
                                                )}
                                                {member.phone && (
                                                    <a href={`tel:${member.phone}`} className="p-2 rounded-lg text-textMuted hover:text-brand hover:bg-brand/10 transition-colors" aria-label={`Call ${member.full_name}`}>
                                                        <Phone size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* ---- Right column (narrower) ---- */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        <Panel icon={<ListChecks size={16} />} title="At a Glance">
                            <div className="flex flex-col gap-2">
                                <button onClick={() => navigate('/clubs-committees')} className="flex items-center justify-between p-3 rounded-xl border border-borderSoft/40 bg-hoverSoft/10 hover:bg-brand/5 hover:border-brand/30 transition-all group text-left">
                                    <span className="text-sm font-medium text-textSecondary group-hover:text-brand transition-colors">Club members</span>
                                    <span className="font-semibold text-textPrimary">{loading ? '–' : uniqueStudentCounts.club}</span>
                                </button>
                                <button onClick={() => navigate('/clubs-committees')} className="flex items-center justify-between p-3 rounded-xl border border-borderSoft/40 bg-hoverSoft/10 hover:bg-brand/5 hover:border-brand/30 transition-all group text-left">
                                    <span className="text-sm font-medium text-textSecondary group-hover:text-brand transition-colors">Committee members</span>
                                    <span className="font-semibold text-textPrimary">{loading ? '–' : uniqueStudentCounts.committee}</span>
                                </button>
                                <button onClick={() => navigate('/clubs-committees')} className="flex items-center justify-between p-3 rounded-xl border border-borderSoft/40 bg-hoverSoft/10 hover:bg-brand/5 hover:border-brand/30 transition-all group text-left">
                                    <span className="text-sm font-medium text-textSecondary group-hover:text-brand transition-colors">Organisation members</span>
                                    <span className="font-semibold text-textPrimary">{loading ? '–' : uniqueStudentCounts.organisation}</span>
                                </button>

                                <div className="h-px bg-borderSoft/60 my-1 mx-2" />

                                <div className="flex items-center justify-between p-3 rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all group cursor-default">
                                    <span className="text-sm font-bold text-textPrimary group-hover:text-brand transition-colors">Total student members</span>
                                    <span className="font-bold text-brand">{loading ? '–' : uniqueStudentCounts.total}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all group cursor-default">
                                    <span className="text-sm font-bold text-textPrimary group-hover:text-brand transition-colors">Total Activities</span>
                                    <span className="font-bold text-brand">{loading ? '–' : (stats as any).total_activities || 0}</span>
                                </div>
                            </div>
                        </Panel>

                        <Panel icon={<Globe size={16} />} title="Resources & Connect">
                            <div className="flex flex-col gap-2.5">
                                <a
                                    href={settings.sbg_constitution_link || '#'}
                                    target={settings.sbg_constitution_link ? '_blank' : '_self'}
                                    rel={settings.sbg_constitution_link ? 'noreferrer' : ''}
                                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-borderSoft/60 bg-hoverSoft/20 hover:bg-brand/5 hover:border-brand/30 transition-all group"
                                >
                                    <FileText size={16} className="text-brand shrink-0" />
                                    <span className="text-sm font-medium text-textSecondary group-hover:text-brand transition-colors">SBG Constitution</span>
                                    <ExternalLink size={12} className="ml-auto text-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                                {settings.sbg_linkedin && (
                                    <a href={settings.sbg_linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-borderSoft/60 bg-hoverSoft/20 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group">
                                        <Linkedin size={16} className="text-textMuted group-hover:text-blue-500 transition-colors shrink-0" />
                                        <span className="text-sm font-medium text-textSecondary group-hover:text-blue-500 transition-colors">LinkedIn</span>
                                    </a>
                                )}
                                {settings.sbg_email && (
                                    <a href={`mailto:${settings.sbg_email}`} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-borderSoft/60 bg-hoverSoft/20 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group">
                                        <Mail size={16} className="text-textMuted group-hover:text-emerald-500 transition-colors shrink-0" />
                                        <span className="text-sm font-medium text-textSecondary group-hover:text-emerald-500 transition-colors">{settings.sbg_email}</span>
                                    </a>
                                )}
                            </div>
                        </Panel>
                    </div>
                </div>
            </main>

            {/* ====== Footer ====== */}
            <footer className="px-4 py-10 text-center text-xs text-textMuted border-t border-borderSoft/40 mt-10">
                <p className="font-medium text-textSecondary">
                    &copy; SBG {new Date().getFullYear()}
                </p>
                <div className="mt-4 flex justify-center">
                    <GdgFooterCredit />
                </div>
            </footer>

            {/* ====== EC Modal ====== */}
            <Dialog open={ecModalOpen} onOpenChange={setEcModalOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden bg-card border-borderSoft/60 shadow-2xl">
                    <div className="p-6">
                        <DialogHeader className="mb-6 space-y-1 pr-8">
                            <div className="flex items-center gap-3 mb-2">
                                {ecClub?.logo_url ? (
                                    <img src={ecClub.logo_url} alt="EC Logo" className="h-10 w-10 shrink-0 rounded-xl object-cover bg-card border border-borderSoft/60 shadow-sm overflow-hidden" />
                                ) : (
                                    <span className="h-10 w-10 shrink-0 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                                        <Building2 size={20} />
                                    </span>
                                )}
                                <div>
                                    <DialogTitle className="text-lg sm:text-xl font-bold text-textPrimary leading-tight">The Election Commission</DialogTitle>
                                    <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-0.5">Independent Body</p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6">
                            <p className="text-sm text-textSecondary leading-relaxed">
                                An independent, autonomous body responsible for organising fair elections, keeping the process transparent, and resolving grievances raised along the way.
                            </p>

                            {/* Links */}
                            <div className="flex flex-wrap gap-2">
                                {ecClub?.email && (
                                    <a href={`mailto:${ecClub.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-borderSoft/60 bg-hoverSoft/20 hover:bg-brand/10 hover:text-brand transition-colors">
                                        <Mail size={14} /> Email
                                    </a>
                                )}
                                {ecClub?.website_url && (
                                    <a href={ecClub.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-borderSoft/60 bg-hoverSoft/20 hover:bg-brand/10 hover:text-brand transition-colors">
                                        <Globe size={14} /> Website
                                    </a>
                                )}
                                {ecClub?.linkedin_url && (
                                    <a href={ecClub.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-borderSoft/60 bg-hoverSoft/20 hover:bg-blue-500/10 hover:text-blue-500 transition-colors">
                                        <Linkedin size={14} /> LinkedIn
                                    </a>
                                )}
                            </div>

                            {/* Members */}
                            <div>
                                <h4 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-3">Commissioners</h4>
                                {ecMembers.length === 0 && !loading ? (
                                    <p className="text-sm text-textMuted">No EC members found.</p>
                                ) : (
                                    <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {ecMembers.map(member => (
                                            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-hoverSoft/20 border border-borderSoft/40">
                                                <div className="h-9 w-9 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {((member as any).profile_picture_url || (member as any).photo_url) ? (
                                                        <img src={(member as any).profile_picture_url || (member as any).photo_url} alt={member.full_name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{initials(member.full_name)}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-textPrimary text-sm truncate">{member.full_name}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${DESIGNATION_COLORS[member.designation] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                                            {member.designation}
                                                        </span>
                                                        {member.roll_number && (
                                                            <span className="text-[10px] text-textMuted font-medium">
                                                                ID: {member.roll_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {member.email && (
                                                    <a href={`mailto:${member.email}`} className="p-1.5 rounded-lg text-textMuted hover:text-brand hover:bg-brand/10 transition-colors shrink-0" aria-label={`Email ${member.full_name}`}>
                                                        <Mail size={13} />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AboutSBG;