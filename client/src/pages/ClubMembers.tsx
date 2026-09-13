import { Edit2, Lock, Plus, Trash2, Users, UserMinus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DatePicker } from '../components/ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { apiRequest } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
import { cn, formatISTDate, isValidPhoneNumber, toLocalISOString } from '../lib/utils';
import { ClubMember, User } from '../types';

interface ApiClub {
  id: string;
  name: string;
  email: string;
}

interface ClubMembersProps {
  user?: User;
}

const ClubMembers: React.FC<ClubMembersProps> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClubId = searchParams.get('clubId') || '';

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [clubs, setClubs] = useState<ApiClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(queryClubId);
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    roll_number: '',
    email: '',
    designation: 'Core',
    phone: '',
    show_number: true,
    is_core_member: true,
    tenure_start_date: '',
    tenure_end_date: '',
    tenure_end_reason: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<ClubMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Resignation Dialog State
  const [resignDialogOpen, setResignDialogOpen] = useState(false);
  const [memberToResign, setMemberToResign] = useState<ClubMember | null>(null);
  const [resignDate, setResignDate] = useState(() => toLocalISOString(new Date()));
  const [resignReason, setResignReason] = useState('Resigned');
  const [isResigning, setIsResigning] = useState(false);

  // Empty All Dialog State
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);

  const isClubUser = user?.role === 'club';
  const isAdmin = user?.role === 'admin';
  const editable = isClubUser || isAdmin;
  const getEntityType = () => {
    if (isClubUser && user?.name) {
      return user.name.toLowerCase().includes('committee') ? 'Committee' : 'Club';
    }
    if (selectedClubId && clubs.length > 0) {
      const selectedClub = clubs.find(c => c.id === selectedClubId);
      if (selectedClub) {
        return selectedClub.name.toLowerCase().includes('committee') ? 'Committee' : 'Club';
      }
    }
    return 'Club';
  };
  const entityType = getEntityType();

  const fetchMembers = async (clubIdToFetch?: string) => {
    setIsLoading(true);
    try {
      const url = clubIdToFetch 
        ? `/api/club-members?clubId=${clubIdToFetch}` 
        : '/api/club-members';
      const data = await apiRequest<ClubMember[]>(url, { auth: true });
      setMembers(data);
    } catch (err) {
      toastError(err, 'Failed to load club members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true);
      if (user?.role === 'admin') {
        try {
          const clubList = await apiRequest<ApiClub[]>('/api/clubs');
          setClubs(clubList);
          
          let activeId = '';
          const urlClubId = searchParams.get('clubId');
          
          if (urlClubId && clubList.some(c => c.id === urlClubId)) {
            activeId = urlClubId;
          } else if (clubList.length > 0) {
            activeId = clubList[0].id;
          }

          if (activeId) {
            setSelectedClubId(activeId);
            setSearchParams({ clubId: activeId }, { replace: true });
            fetchMembers(activeId);
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          toastError(err, 'Failed to load clubs');
          setIsLoading(false);
        }
      } else {
        fetchMembers();
      }
    };

    initPage();
  }, [user]);

  const handleClubChange = (clubId: string) => {
    setSelectedClubId(clubId);
    setSearchParams({ clubId });
    fetchMembers(clubId);
  };

  const openAdd = () => {
    setEditingMember(null);
    setFormData({
      full_name: '',
      roll_number: '',
      email: '',
      designation: 'Core',
      phone: '',
      show_number: true,
      is_core_member: true,
      tenure_start_date: '',
      tenure_end_date: '',
      tenure_end_reason: '',
    });
    setEditDialogOpen(true);
  };

  const openEdit = (member: ClubMember) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      roll_number: member.roll_number ?? '',
      email: member.email ?? '',
      designation: member.designation ?? 'Core',
      phone: member.phone ?? '',
      show_number: member.show_number ?? true,
      is_core_member: true,
      tenure_start_date: member.tenure_start_date ? toLocalISOString(new Date(member.tenure_start_date)) : '',
      tenure_end_date: member.tenure_end_date ? toLocalISOString(new Date(member.tenure_end_date)) : '',
      tenure_end_reason: member.tenure_end_reason ?? '',
    });
    setEditDialogOpen(true);
  };

  const saveMember = async () => {
    setIsSaving(true);
    try {
      if (editingMember) {
        await apiRequest<ClubMember>(`/api/club-members/${editingMember.id}`, {
          method: 'PATCH',
          auth: true,
          body: formData,
        });
        toastSuccess('Member details updated successfully');
      } else {
        await apiRequest<ClubMember>('/api/club-members', {
          method: 'POST',
          auth: true,
          body: formData,
        });
        toastSuccess('Member added to the club successfully');
      }
      setEditDialogOpen(false);
      fetchMembers(user?.role === 'admin' ? selectedClubId : undefined);
    } catch (err) {
      toastError(err, editingMember ? 'Failed to update member' : 'Failed to add member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndTenureClick = (member: ClubMember) => {
    setMemberToResign(member);
    setResignDate(toLocalISOString(new Date()));
    setResignReason('Resigned');
    setResignDialogOpen(true);
  };

  const handleDeleteClick = (member: ClubMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const confirmResign = async () => {
    if (!memberToResign) return;
    setIsResigning(true);
    try {
      await apiRequest(`/api/club-members/${memberToResign.id}`, {
        method: 'PATCH',
        auth: true,
        body: {
          tenure_end_date: resignDate,
          tenure_end_reason: resignReason,
        },
      });
      toastSuccess('Member resignation/impeachment recorded successfully');
      setResignDialogOpen(false);
      fetchMembers(user?.role === 'admin' ? selectedClubId : undefined);
    } catch (err) {
      toastError(err, 'Failed to end member tenure');
    } finally {
      setIsResigning(false);
      setMemberToResign(null);
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/club-members/${memberToDelete.id}`, {
        method: 'DELETE',
        auth: true,
      });
      toastSuccess('Member archived successfully');
      setDeleteDialogOpen(false);
      fetchMembers(user?.role === 'admin' ? selectedClubId : undefined);
    } catch (err) {
      toastError(err, 'Failed to archive member');
    } finally {
      setIsDeleting(false);
      setMemberToDelete(null);
    }
  };

  const confirmEmptyAll = async () => {
    setIsEmptying(true);
    try {
      const url = user?.role === 'admin' 
        ? `/api/club-members/all?clubId=${selectedClubId}`
        : '/api/club-members/all';
      await apiRequest(url, {
        method: 'DELETE',
        auth: true,
      });
      toastSuccess('All members removed successfully');
      setEmptyDialogOpen(false);
      fetchMembers(user?.role === 'admin' ? selectedClubId : undefined);
    } catch (err) {
      toastError(err, 'Failed to remove members');
    } finally {
      setIsEmptying(false);
    }
  };

  const DEFAULT_BADGE_STYLE = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 font-medium';

  const getDesignationBadgeStyle = (des?: string) => {
    if (!des) return DEFAULT_BADGE_STYLE;
    const d = des.toLowerCase().trim();
    if (d === 'convener') return 'bg-brand/10 text-brand border-brand/20 font-semibold';
    if (d === 'dy. convener' || d === 'dy convener') return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20 font-medium';
    if (d === 'core') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium';
    if (d === 'extended core' || d === 'associate core') return DEFAULT_BADGE_STYLE;
    if (d === 'others') return DEFAULT_BADGE_STYLE;
    return 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/20 font-medium'; // Special tags
  };

  const MemberRow = ({ member, editable }: { member: ClubMember; editable: boolean }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-borderSoft bg-card/50 hover:bg-hoverSoft/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-textPrimary">{member.full_name}</p>
          <Badge 
            variant="secondary" 
            className={getDesignationBadgeStyle(member.designation)}
          >
            {member.designation || 'Core'}
          </Badge>
        </div>
        {member.roll_number && (
          <p className="text-sm text-textMuted mt-0.5">
            Roll: {member.roll_number}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-textMuted">
          {member.email && <span>{member.email}</span>}
          {member.phone && <span>{member.phone}</span>}
          {(member.tenure_start_date || member.tenure_end_date) && (
            <span>
              Tenure: {member.tenure_start_date ? formatISTDate(member.tenure_start_date, {
                year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'} –{' '}
              {member.tenure_end_date ? formatISTDate(member.tenure_end_date, {
                year: 'numeric', month: 'short', day: 'numeric' }) : 'Present'}
            </span>
          )}
          {member.tenure_end_reason && (
            <span className="font-semibold text-error/95">
              Reason: {member.tenure_end_reason}
            </span>
          )}
        </div>
      </div>
      {editable ? (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
          {isClubUser && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => openEdit(member)} 
              className="rounded-lg h-9 w-9 p-0" 
              title="Edit Member"
              aria-label={`Edit ${member.full_name}`}
            >
              <Edit2 size={14} />
            </Button>
          )}
          {(!member.tenure_end_reason && (!member.tenure_end_date || new Date(member.tenure_end_date) >= new Date(new Date().setHours(0,0,0,0)))) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEndTenureClick(member)}
              className="rounded-lg h-9 w-9 p-0 text-brand hover:text-brand hover:bg-brand/10 border-brand/20"
              title="End Tenure"
              aria-label={`End tenure for ${member.full_name}`}
            >
              <UserMinus size={14} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteClick(member)}
            className="rounded-lg h-9 w-9 p-0 text-error hover:text-error hover:bg-error/10 border-error/20"
            title="Delete Member"
            aria-label={`Delete ${member.full_name}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-textMuted shrink-0">
          <Lock size={14} />
          View only
        </div>
      )}
    </div>
  );

  const activeMembers = members.filter(m => {
    if (m.tenure_end_reason) return false;
    if (!m.tenure_end_date) return true;
    const endDate = new Date(m.tenure_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
  });

  const pastMembers = members.filter(m => {
    if (m.tenure_end_reason) return true;
    if (!m.tenure_end_date) return false;
    const endDate = new Date(m.tenure_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight flex items-center gap-2 leading-tight">
            <Users className="text-brand shrink-0" size={28} />
            <span className="whitespace-normal">{entityType} Members</span>
          </h1>
          <p className="text-textMuted mt-1 text-sm sm:text-base">
            {isClubUser
              ? `Manage your ${entityType.toLowerCase()} members. Add, edit, or remove members as needed.`
              : `View member directories of different campus clubs.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:self-center max-w-full">
          {!isClubUser && clubs.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto max-w-full">
              <Label htmlFor="club-select" className="text-xs text-textMuted shrink-0 font-medium">{entityType}:</Label>
              <Select value={selectedClubId} onValueChange={handleClubChange}>
                <SelectTrigger id="club-select" aria-label={`Select ${entityType}`} className="h-9 w-full sm:w-[200px] bg-card border-borderSoft focus:ring-brand/30">
                  <SelectValue placeholder={`Select a ${entityType.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-borderSoft max-h-[300px]">
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {members.length > 0 && (user?.role === 'admin' || isClubUser) && (
            <Button variant="destructive" onClick={() => setEmptyDialogOpen(true)} aria-label="Empty all members" className="w-full sm:w-auto rounded-xl font-semibold gap-1.5 whitespace-nowrap">
              <Trash2 size={16} />
              Empty All
            </Button>
          )}

          {isClubUser && (
            <Button onClick={openAdd} aria-label="Add Member" className="w-full sm:w-auto rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold whitespace-nowrap">
              <Plus size={16} className="mr-1.5" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="border-borderSoft shadow-sm bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Active {entityType} Members</CardTitle>
              <CardDescription>
                Conveners, core leadership, and active coordinators currently serving their tenure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeMembers.length === 0 ? (
                <p className="text-sm text-textMuted py-4 text-center">No active {entityType.toLowerCase()} members listed yet.</p>
              ) : (
                activeMembers.map((m) => <MemberRow key={m.id} member={m} editable={editable} />)
              )}
            </CardContent>
          </Card>

          <Card className="border-borderSoft shadow-sm bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Past / Resigned Members</CardTitle>
              <CardDescription>
                Members who have resigned, completed their tenure, or been impeached.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pastMembers.length === 0 ? (
                <p className="text-sm text-textMuted py-4 text-center">No past/resigned members recorded.</p>
              ) : (
                pastMembers.map((m) => <MemberRow key={m.id} member={m} editable={editable} />)
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-xl font-bold text-textPrimary">
              {editingMember ? 'Edit Member Details' : `Add ${entityType} Member`}
            </DialogTitle>
            <DialogDescription className="text-sm text-textMuted">
              {editingMember
                ? `Update information for ${editingMember.full_name}`
                : `Enter the ${entityType.toLowerCase()} details to add a new member.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name" className="text-sm font-medium">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="rounded-xl"
                placeholder="e.g. Rahul Sen"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="roll_number" className="text-sm font-medium">Roll Number *</Label>
              <Input
                id="roll_number"
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                className="rounded-xl"
                placeholder="e.g. 22BCS001"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="rounded-xl"
                placeholder="e.g. rahul@student.dau.ac.in"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="designation" className="text-sm font-medium">Designation *</Label>
              <Select
                value={['Convener', 'Dy. Convener', 'Core'].includes(formData.designation) ? formData.designation : 'Special Designation'}
                onValueChange={(val) => {
                  if (val === 'Special Designation') {
                    setFormData({ ...formData, designation: '' });
                  } else {
                    setFormData({ ...formData, designation: val });
                  }
                }}
              >
                <SelectTrigger id="designation" className="w-full rounded-xl">
                  <SelectValue placeholder="Select Designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Convener">Convener</SelectItem>
                  <SelectItem value="Dy. Convener">Dy. Convener</SelectItem>
                  <SelectItem value="Core">Core</SelectItem>
                  <SelectItem value="Special Designation">Special Designation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!['Convener', 'Dy. Convener', 'Core'].includes(formData.designation) && (
              <div className="flex flex-col gap-2 animate-in fade-in-50 duration-200">
                <Label htmlFor="custom_designation" className="text-sm font-medium">Custom Designation Title *</Label>
                <Input
                  id="custom_designation"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="rounded-xl"
                  placeholder="e.g. Technical Head, Webmaster"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="rounded-xl"
                placeholder="e.g. 9876543210"
              />
            </div>

            <div className="flex flex-row items-center justify-between rounded-xl border border-borderSoft p-3 shadow-sm bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="show_number" className="text-sm font-medium">Show Phone Number</Label>
                <p className="text-[10px] sm:text-xs text-textMuted">Display on public directories (e.g., About SBG)</p>
              </div>
              <Switch
                id="show_number"
                checked={formData.show_number}
                onCheckedChange={(checked) => setFormData({ ...formData, show_number: checked })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tenure_start_date" className="text-sm font-medium">Tenure Start Date *</Label>
              <DatePicker
                date={formData.tenure_start_date ? new Date(formData.tenure_start_date) : undefined}
                setDate={(d) => setFormData({ ...formData, tenure_start_date: d ? toLocalISOString(d) : '' })}
              />
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-borderSoft">
            <Button
              onClick={saveMember}
              disabled={isSaving || !formData.full_name.trim() || !formData.roll_number.trim() || !formData.email.trim() || !formData.email.trim().endsWith('@dau.ac.in') || !isValidPhoneNumber(formData.phone) || !formData.tenure_start_date.trim() || !formData.designation.trim()}
              className="rounded-xl w-full sm:w-auto"
            >
              {isSaving ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-error/10 p-6 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-error/20 flex items-center justify-center mb-4">
              <Trash2 className="text-error" size={32} />
            </div>
            <DialogTitle className="text-xl font-bold text-error">
              Archive Member
            </DialogTitle>
          </div>
          <div className="p-6">
            <DialogDescription className="text-center text-textSecondary text-base">
              Are you sure you want to remove <strong className="text-textPrimary">{memberToDelete?.full_name}</strong> from the active database? They will be moved to the Archives.
            </DialogDescription>
            <div className="flex gap-3 mt-8 justify-end">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting} className="rounded-xl">
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
                {isDeleting ? 'Archiving...' : 'Yes, Remove & Archive'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resignation / Impeachment Dialog */}
      <Dialog open={resignDialogOpen} onOpenChange={setResignDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-xl font-bold text-textPrimary flex items-center gap-2">
              End Member Tenure
            </DialogTitle>
            <DialogDescription className="text-sm text-textMuted">
              Specify the date and reason for <strong className="text-textPrimary">{memberToResign?.full_name}</strong> to move them to Past Members.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Date *</Label>
              <DatePicker
                date={resignDate ? new Date(resignDate) : undefined}
                setDate={(d) => setResignDate(d ? toLocalISOString(d) : '')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="resign_reason" className="text-sm font-medium">Reason *</Label>
              <Select
                value={resignReason}
                onValueChange={(val) => setResignReason(val)}
              >
                <SelectTrigger id="resign_reason" className="w-full rounded-xl">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Resigned">Resigned</SelectItem>
                  <SelectItem value="Impeached">Impeached</SelectItem>
                  <SelectItem value="Tenure Ended">Tenure Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-borderSoft flex sm:justify-between items-center w-full">
            <div className="flex-1"></div>
            <Button
              onClick={confirmResign}
              disabled={isResigning || !resignDate}
              className="rounded-xl w-full sm:w-auto"
            >
              {isResigning ? 'Recording...' : 'End Tenure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty All Confirmation Dialog */}
      <Dialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <Trash2 size={20} />
              Empty All Members
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong className="text-textPrimary">ALL</strong> members for this {entityType.toLowerCase()}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEmptyDialogOpen(false)} disabled={isEmptying} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmEmptyAll} disabled={isEmptying} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
              {isEmptying ? 'Emptying...' : 'Yes, Empty All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubMembers;
