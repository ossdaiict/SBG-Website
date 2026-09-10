import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    Building2,
    Globe,
    Instagram,
    Layers,
    Linkedin,
    Mail,
    Phone,
    Search,
    Users,
    Youtube
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { apiRequest } from '../lib/api';
import { formatISTDate } from '../lib/utils';
import { toastError } from '../lib/toast';

import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';


interface Club {
    id: string;
    name: string;
    email: string;
    group_category: string;
    description?: string;
    key_activities?: string;
    linkedin_url?: string;
    instagram_url?: string;
    youtube_url?: string;
    website_url?: string;
    logo_url?: string;
    logo_bg?: string;
    organization_type: string;
    member_tag?: string;
}

interface CommitteeMember {
    id: string;
    club_id: string;
    club_name: string;
    full_name: string;
    roll_number: string | null;
    designation: string;
    phone: string | null;
    tenure_start_date: string | null;
    tenure_end_date: string | null;
}

const DEFAULT_BADGE_STYLE = 'bg-slate-500/10 text-slate-500 border-slate-500/20';

const getDesignationRank = (des?: string) => {
    if (!des) return 6;
    const d = des.toLowerCase().trim();
    if (d === 'convener') return 1;
    if (d === 'dy. convener' || d === 'dy convener') return 2;
    if (d === 'core') return 4;
    if (d === 'extended core' || d === 'associate core') return 5;
    if (d === 'others') return 6;
    return 3; // Special member tags
};

const getDesignationBadgeStyle = (des?: string) => {
    if (!des) return DEFAULT_BADGE_STYLE;
    const d = des.toLowerCase().trim();
    if (d === 'convener') return 'bg-brand/10 text-brand border-brand/20';
    if (d === 'dy. convener' || d === 'dy convener') return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    if (d === 'core') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (d === 'extended core' || d === 'associate core') return DEFAULT_BADGE_STYLE;
    if (d === 'others') return DEFAULT_BADGE_STYLE;
    return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'; // Special tags
};

const ClubsCommitteesPage: React.FC = () => {
    const navigate = useNavigate();
    const [clubs, setClubs] = useState<Club[]>([]);
    const [members, setMembers] = useState<CommitteeMember[]>([]);
    const touchStartY = useRef<number>(0);
    const [dragY, setDragY] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'club' | 'committee' | 'organisation'>('club');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClubForModal, setSelectedClubForModal] = useState<Club | null>(null);
    const [modalTab, setModalTab] = useState<'about' | 'members'>('about');

    const selectedClubMembers = useMemo(() => {
        if (!selectedClubForModal) return [];
        let clubMems = members.filter(m => m.club_id === selectedClubForModal.id);

        clubMems.sort((a, b) => getDesignationRank(a.designation) - getDesignationRank(b.designation));

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesClub = selectedClubForModal.name.toLowerCase().includes(q) ||
                selectedClubForModal.email.toLowerCase().includes(q) ||
                (!!selectedClubForModal.member_tag && selectedClubForModal.member_tag.toLowerCase().includes(q));

            if (matchesClub) {
                return clubMems;
            }

            clubMems = clubMems.filter(m =>
                m.full_name.toLowerCase().includes(q) ||
                (m.designation && m.designation.toLowerCase().includes(q)) ||
                (m.roll_number && String(m.roll_number).toLowerCase().includes(q))
            );
        }
        return clubMems;
    }, [members, selectedClubForModal, searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [clubsData, membersData] = await Promise.all([
                    apiRequest<Club[]>('/api/clubs'),
                    apiRequest<CommitteeMember[]>('/api/club-members/public'),
                ]);
                setClubs(clubsData);
                setMembers(membersData);
            } catch (err) {
                toastError(err, 'Failed to load directories');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredClubs = useMemo(() => {
        return clubs.filter(c => {
            if (c.organization_type === 'other') return false;

            const q = searchQuery.toLowerCase();
            const matchesClub = c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (!!c.member_tag && c.member_tag.toLowerCase().includes(q));

            const hasMatchingMember = members.some(m => m.club_id === c.id && (
                m.full_name.toLowerCase().includes(q) ||
                (m.designation && m.designation.toLowerCase().includes(q))
            ));

            const matchesSearch = matchesClub || hasMatchingMember;
            const matchesTab = c.organization_type === activeTab;

            return matchesSearch && matchesTab;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [clubs, members, searchQuery, activeTab]);

    const groupedCommittees = useMemo(() => {
        const groups: Record<string, CommitteeMember[]> = {};
        for (const m of members) {
            // Filter by search query if present
            const matchesQuery = searchQuery === '' ||
                m.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.designation && m.designation.toLowerCase().includes(searchQuery.toLowerCase()));

            if (matchesQuery) {
                const clubName = m.club_name;
                if (!groups[clubName]) {
                    groups[clubName] = [];
                }
                groups[clubName].push(m);
            }
        }
        return groups;
    }, [members, searchQuery]);

    const formatTenure = (start?: string | null, end?: string | null) => {
        if (!start && !end) return 'Not Specified';
        const sStr = start ? formatISTDate(start, {
            year: 'numeric', month: 'short'
        }) : 'N/A';
        const eStr = end ? formatISTDate(end, {
            year: 'numeric', month: 'short'
        }) : 'Present';
        return `${sStr} – ${eStr}`;
    };

    return (
        <div className="min-h-dvh bg-bgMain pb-16">

            {/* ====== Main Content ====== */}
            <main>
                {/* ====== Hero Section ====== */}
                <section className="relative z-10 text-center px-4 sm:px-6 3xl:px-12 pt-12 3xl:pt-20 pb-8 3xl:pb-12 max-w-4xl 3xl:max-w-6xl 4k:max-w-7xl mx-auto">
                    <motion.h1
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl sm:text-5xl 3xl:text-6xl 4k:text-7xl font-extrabold tracking-tighter text-textPrimary pb-2"
                    >
                        Clubs & Committees
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-4 3xl:mt-6 text-base sm:text-lg 3xl:text-xl text-textSecondary max-w-xl 3xl:max-w-3xl mx-auto font-medium"
                    >
                        Explore campus student organizations and active leadership in one place.
                    </motion.p>
                </section>

                {/* ====== Tabs & Search Controls ====== */}
                <section className="relative z-10 max-w-5xl 3xl:max-w-[1600px] 4k:max-w-[2100px] uhd:max-w-[2800px] mx-auto px-4 sm:px-6 3xl:px-10 mb-8 space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        {/* Framer motion segment tabs control */}
                        <div className="flex flex-nowrap overflow-x-auto bg-hoverSoft/50 p-1 rounded-xl border border-borderSoft/40 w-full sm:w-auto self-start gap-1">
                            {(['club', 'committee', 'organisation'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                                    className={`
                                    relative px-2 sm:px-5 py-2 text-[11px] sm:text-sm font-semibold rounded-lg transition-colors flex-1 sm:flex-none sm:w-auto capitalize cursor-pointer whitespace-nowrap
                                    ${activeTab === tab ? 'text-brand' : 'text-textMuted hover:text-textPrimary hover:bg-hoverSoft'}
                                `}
                                >
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="active-directory-tab"
                                            className="absolute inset-0 bg-card border border-borderSoft rounded-lg shadow-sm"
                                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                                        {tab === 'club' ? <Layers size={15} /> : tab === 'committee' ? <Users size={15} /> : <Building2 size={15} />}
                                        {tab}s
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search filter input */}
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted z-99 h-4 w-4" />
                            <Input
                                placeholder={`Search ${activeTab}s...`}
                                className="pl-9 bg-card border-borderSoft/60 focus:border-brand rounded-xl h-10 w-full"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* ====== Club Committee Roster Modal ====== */}
                <Dialog open={!!selectedClubForModal} onOpenChange={(open) => {
                    if (!open) {
                        setSelectedClubForModal(null);
                        setTimeout(() => { setDragY(0); setModalTab('about'); }, 300);
                    }
                }}>
                    <DialogContent 
                        className="w-[95vw] max-w-[95vw] sm:w-full sm:max-w-xl p-4 sm:p-6 rounded-2xl max-h-[85dvh] overflow-y-auto bg-card transition-none"
                        style={{ 
                            transform: dragY > 0 ? (window.innerWidth < 640 ? `translateY(${dragY}px)` : `translate(-50%, calc(-50% + ${dragY}px))`) : '',
                            transition: dragY === 0 ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none'
                        }}
                    >
                        <DialogHeader 
                            className="border-b border-borderSoft/40 pb-4 pr-14 flex flex-row items-center gap-3 sm:gap-4 space-y-0 select-none cursor-grab active:cursor-grabbing sm:cursor-default sm:active:cursor-auto"
                            onTouchStart={(e) => {
                                touchStartY.current = e.touches[0].clientY;
                            }}
                            onTouchMove={(e) => {
                                const y = e.touches[0].clientY - touchStartY.current;
                                if (y > 0) {
                                    setDragY(y);
                                }
                            }}
                            onTouchEnd={(e) => {
                                if (dragY > 100) {
                                    setSelectedClubForModal(null);
                                    setModalTab('about');
                                }
                                setDragY(0);
                            }}
                        >
                            <Avatar className={cn("h-14 w-14 border border-borderSoft rounded-2xl shrink-0", selectedClubForModal?.logo_bg === 'white' ? 'bg-white' : selectedClubForModal?.logo_bg === 'dark' ? 'bg-slate-900' : 'bg-transparent')}>
                                <AvatarImage src={selectedClubForModal?.logo_url || ''} alt={selectedClubForModal?.name} className="object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
                                <AvatarFallback className="bg-brand text-white font-bold text-lg rounded-2xl flex items-center justify-center">
                                    {selectedClubForModal?.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-[16px] sm:text-xl font-bold text-textPrimary leading-tight wrap-break-word">
                                    {selectedClubForModal?.name}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-textMuted mt-1">
                                    {selectedClubForModal?.member_tag}
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <Tabs value={modalTab} onValueChange={(value) => setModalTab(value as 'about' | 'members')} className="w-full mt-4">
                            <TabsList className="grid w-full grid-cols-2 gap-1 mb-4 bg-hoverSoft/80 p-1 rounded-xl border border-borderSoft items-stretch">
                                {(['about', 'members'] as const).map(tab => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        className="relative rounded-lg px-3.5 py-1.5 text-sm font-medium cursor-pointer bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-textPrimary hover:text-textPrimary hover:bg-hoverSoft"
                                    >
                                        {modalTab === tab && (
                                            <motion.div
                                                layoutId="active-modal-tab"
                                                className="absolute inset-0 bg-card border border-borderSoft rounded-lg shadow-sm"
                                                transition={dragY !== 0 ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative z-10 capitalize">{tab}</span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <TabsContent value="members" className="min-h-[250px] max-h-[50dvh] flex flex-col focus-visible:outline-none focus-visible:ring-0 mt-0">
                                <div className="flex items-center justify-between px-1 mb-3 shrink-0">
                                    <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">Members</span>
                                    <span className="text-xs text-textMuted font-medium">{selectedClubMembers.length} member{selectedClubMembers.length !== 1 ? 's' : ''}</span>
                                </div>

                                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                                    {selectedClubMembers.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-textMuted bg-hoverSoft/20 rounded-xl border border-dashed border-borderSoft p-6">
                                            No members listed for this club.
                                        </div>
                                    ) : (
                                        selectedClubMembers.map(member => (
                                            <div
                                                key={member.id}
                                                className="p-3.5 rounded-xl border border-borderSoft/60 bg-hoverSoft/15 hover:bg-hoverSoft/30 transition-colors flex flex-row items-center justify-between gap-3"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-textPrimary text-sm sm:text-base">{member.full_name}</span>
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getDesignationBadgeStyle(member.designation)}`}>
                                                            {member.designation}
                                                        </span>
                                                    </div>
                                                    {member.roll_number && (
                                                        <div className="text-xs text-textMuted font-medium">
                                                            ID: {member.roll_number}
                                                        </div>
                                                    )}
                                                </div>

                                                {member.phone && (
                                                    <a
                                                        href={`tel:${member.phone}`}
                                                        className="h-8 px-3 rounded-lg border border-borderSoft/60 bg-background hover:bg-hoverSoft hover:text-brand text-xs font-semibold text-textSecondary flex items-center gap-1.5 shrink-0 transition-all shadow-sm"
                                                    >
                                                        <Phone size={12} />
                                                    </a>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="about" className="min-h-[250px] max-h-[50dvh] flex flex-col focus-visible:outline-none focus-visible:ring-0 mt-0">
                                <div className="space-y-4 flex-1 overflow-y-auto pr-1 pb-2">
                                    <div className="space-y-2">
                                        <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">About</span>
                                        <p className="text-sm text-textSecondary leading-relaxed bg-hoverSoft/15 border border-borderSoft/60 rounded-xl p-3.5 whitespace-pre-wrap">
                                            {selectedClubForModal?.description || "Description not available."}
                                        </p>
                                    </div>
                                    {selectedClubForModal?.key_activities && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">Key Activities & Events</span>
                                            <p className="text-sm text-textSecondary leading-relaxed bg-hoverSoft/15 border border-borderSoft/60 rounded-xl p-3.5 whitespace-pre-wrap">
                                                {selectedClubForModal.key_activities}
                                            </p>
                                        </div>
                                    )}
                                    {(selectedClubForModal?.website_url ||
                                        selectedClubForModal?.linkedin_url ||
                                        selectedClubForModal?.instagram_url ||
                                        selectedClubForModal?.youtube_url) && (
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">Links & Socials</span>
                                                <div className="flex flex-wrap gap-2 bg-hoverSoft/15 border border-borderSoft/60 rounded-xl p-3.5">
                                                    {selectedClubForModal?.website_url && (
                                                        <a
                                                            href={selectedClubForModal.website_url.startsWith('http') ? selectedClubForModal.website_url : `https://${selectedClubForModal.website_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-borderSoft/60 bg-background hover:bg-hoverSoft hover:text-brand text-xs font-semibold text-textSecondary transition-all shadow-sm"
                                                        >
                                                            <Globe size={13} className="text-textMuted" />
                                                            Website
                                                        </a>
                                                    )}
                                                    {selectedClubForModal?.linkedin_url && (
                                                        <a
                                                            href={selectedClubForModal.linkedin_url.startsWith('http') ? selectedClubForModal.linkedin_url : `https://${selectedClubForModal.linkedin_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-borderSoft/60 bg-background hover:bg-hoverSoft hover:text-brand text-xs font-semibold text-textSecondary transition-all shadow-sm"
                                                        >
                                                            <Linkedin size={13} className="text-textMuted" />
                                                            LinkedIn
                                                        </a>
                                                    )}
                                                    {selectedClubForModal?.instagram_url && selectedClubForModal.instagram_url.split(',').map((url, i, arr) => {
                                                        const cleanUrl = url.trim();
                                                        if (!cleanUrl) return null;
                                                        return (
                                                            <a
                                                                key={i}
                                                                href={cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-borderSoft/60 bg-background hover:bg-hoverSoft hover:text-brand text-xs font-semibold text-textSecondary transition-all shadow-sm"
                                                            >
                                                                <Instagram size={13} className="text-textMuted" />
                                                                Instagram {arr.length > 1 ? i + 1 : ''}
                                                            </a>
                                                        );
                                                    })}
                                                    {selectedClubForModal?.youtube_url && (
                                                        <a
                                                            href={selectedClubForModal.youtube_url.startsWith('http') ? selectedClubForModal.youtube_url : `https://${selectedClubForModal.youtube_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-borderSoft/60 bg-background hover:bg-hoverSoft hover:text-brand text-xs font-semibold text-textSecondary transition-all shadow-sm"
                                                        >
                                                            <Youtube size={13} className="text-textMuted" />
                                                            YouTube
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </TabsContent>

                            {selectedClubForModal?.email && (
                                <div className="pt-4 border-t border-borderSoft/40 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-center sm:text-left">
                                    <span className="text-xs text-textMuted">Have questions or want to join?</span>
                                    <Button
                                        asChild
                                        className="rounded-xl h-9 px-4 text-xs font-semibold bg-brand text-white hover:bg-brandLink w-full sm:w-auto cursor-pointer"
                                    >
                                        <a href={`mailto:${selectedClubForModal.email}`}>
                                            <Mail size={13} className="mr-1.5" />
                                            Email Contact
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </Tabs>
                    </DialogContent>
                </Dialog>

                {/* ====== Content Display ====== */}
                <section className="relative z-10 max-w-5xl 3xl:max-w-[1600px] 4k:max-w-[2100px] uhd:max-w-[2800px] mx-auto px-4 sm:px-6 3xl:px-10">
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-4"
                            >
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-32 rounded-xl bg-hoverSoft/30 border border-borderSoft animate-pulse" />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-5"
                            >
                                {filteredClubs.length === 0 ? (
                                    <div className="col-span-full py-16 text-center text-textMuted">
                                        No {activeTab}s found matching your search.
                                    </div>
                                ) : (
                                    filteredClubs.map(club => (
                                        <motion.div
                                            key={club.id}
                                            whileHover={{ y: -4 }}
                                            className="rounded-2xl border border-borderSoft bg-card/60 backdrop-blur shadow-sm hover:shadow-md p-5 flex flex-col justify-between transition-all group"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className={cn("h-10 w-10 border border-borderSoft rounded-xl shrink-0", club.logo_bg === 'white' ? 'bg-white' : club.logo_bg === 'dark' ? 'bg-slate-900' : 'bg-transparent')}>
                                                        <AvatarImage src={club.logo_url || ''} alt={club.name} className="object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
                                                        <AvatarFallback className="bg-brand/10 text-brand font-bold text-sm rounded-xl flex items-center justify-center">
                                                            {club.name.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h3 className="font-bold text-base text-textPrimary tracking-tight transition-colors">{club.name}</h3>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 pt-3 border-t border-borderSoft/30 flex items-center justify-between">
                                                <a
                                                    href={`mailto:${club.email}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-xs font-semibold text-textSecondary hover:text-brand flex items-center gap-1.5 transition-colors cursor-pointer"
                                                >
                                                    <Mail size={13} />
                                                    Contact {club.organization_type === 'other' ? 'Club' : (club.organization_type.charAt(0).toUpperCase() + club.organization_type.slice(1))}
                                                </a>
                                                <button
                                                    onClick={() => setSelectedClubForModal(club)}
                                                    className="text-[11px] font-semibold text-brand flex items-center gap-0.5 hover:underline cursor-pointer"
                                                >
                                                    About {club.organization_type === 'other' ? 'Club' : (club.organization_type.charAt(0).toUpperCase() + club.organization_type.slice(1))}
                                                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main>
        </div>
    );
};

export default ClubsCommitteesPage;