import { motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, Edit2, MapPin, Plus, Trash2, Users, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { apiRequest, type ApiVenue } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';

const AdminVenues: React.FC = () => {
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<ApiVenue | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'needs_approval',
    capacity: '',
    location: '',
    is_active: true
  });

  const fetchVenues = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<ApiVenue[]>('/api/venues');
      setVenues(data);
    } catch (error) {
      console.error('Failed to load venues:', error);
      toastError(error, 'Failed to load venues');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const handleOpenModal = (venue?: ApiVenue) => {
    if (venue) {
      setEditingVenue(venue);
      setFormData({
        name: venue.name,
        category: venue.category,
        capacity: venue.capacity ? venue.capacity.toString() : '',
        location: venue.location || '',
        is_active: venue.is_active !== false
      });
    } else {
      setEditingVenue(null);
      setFormData({
        name: '',
        category: 'needs_approval',
        capacity: '',
        location: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVenue(null);
  };

  const handleToggleActive = async (venue: ApiVenue) => {
    const newStatus = venue.is_active === false ? true : false;
    try {
      // Optimistic update
      setVenues(prev => prev.map(v => v.id === venue.id ? { ...v, is_active: newStatus } : v));
      
      await apiRequest(`/api/admin/venues/${venue.id}`, {
        method: 'PATCH',
        auth: true,
        body: { is_active: newStatus }
      });
      toastSuccess(`Venue "${venue.name}" marked as ${newStatus ? 'Active' : 'Inactive'}`);
    } catch (error) {
      // Rollback
      setVenues(prev => prev.map(v => v.id === venue.id ? { ...v, is_active: venue.is_active !== false } : v));
      toastError(error, 'Failed to update venue status');
    }
  };

  const handleSaveVenue = async () => {
    if (!formData.name.trim() || !formData.category) {
      toastError('Name and category are required');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        location: formData.location.trim() || null,
        is_active: formData.is_active
      };

      if (editingVenue) {
        await apiRequest(`/api/admin/venues/${editingVenue.id}`, {
          method: 'PATCH',
          auth: true,
          body: payload
        });
        toastSuccess('Venue updated successfully');
      } else {
        await apiRequest('/api/admin/venues', {
          method: 'POST',
          auth: true,
          body: payload
        });
        toastSuccess('Venue added successfully');
      }
      
      handleCloseModal();
      fetchVenues();
    } catch (error) {
      toastError(error, 'Failed to save venue');
    }
  };

  const handleDeleteVenue = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone and will delete associated bookings.`)) {
      return;
    }
    try {
      await apiRequest(`/api/admin/venues/${id}`, {
        method: 'DELETE',
        auth: true
      });
      toastSuccess('Venue deleted successfully');
      setVenues(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      toastError(error, 'Failed to delete venue');
    }
  };

  const totalPages = Math.ceil(venues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVenues = venues.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-textPrimary leading-tight">Manage Venues</h1>
          <p className="text-textSecondary mt-1 text-sm font-medium">Add, edit, enable, disable, or remove venues available for booking.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus size={16} /> Add Venue
        </Button>
      </div>

      <div className="bg-card border border-borderSoft rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-hoverSoft border-b border-borderSoft uppercase tracking-wider text-xs font-semibold text-textMuted text-center">
              <tr>
                <th className="px-3 py-2 sm:py-4 w-[25%] text-center">Venue Name</th>
                <th className="px-3 py-2 sm:py-4 w-[15%] text-center">Status</th>
                <th className="px-3 py-2 sm:py-4 w-[20%] text-center">Category</th>
                <th className="px-3 py-2 sm:py-4 w-[10%] text-center">Capacity</th>
                <th className="px-3 py-2 sm:py-4 w-[20%] text-center">Location</th>
                <th className="px-3 py-2 sm:py-4 w-[10%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSoft">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 sm:py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-3 py-2 sm:py-4 text-center"><Skeleton className="h-5 w-20 mx-auto" /></td>
                    <td className="px-3 py-2 sm:py-4 text-center"><Skeleton className="h-5 w-24 mx-auto" /></td>
                    <td className="px-3 py-2 sm:py-4 text-center"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="px-3 py-2 sm:py-4 text-center"><Skeleton className="h-5 w-24 mx-auto" /></td>
                    <td className="px-3 py-2 sm:py-4 text-center"><Skeleton className="h-8 w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-2 sm:py-8 text-center text-textMuted">
                    <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                    No venues found.
                  </td>
                </tr>
              ) : (
                paginatedVenues.map(venue => {
                  const isActive = venue.is_active !== false;
                  return (
                    <motion.tr 
                      key={venue.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-hoverSoft/30 transition-colors group ${!isActive ? 'opacity-60 bg-muted/20' : ''}`}
                    >
                      <td className="px-3 py-2 sm:py-4">
                        <span className="font-semibold text-textPrimary">{venue.name}</span>
                        {!isActive && (
                          <span className="ml-2 text-xs text-muted-foreground italic">(Unavailable for new bookings)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 sm:py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(venue)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer border ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20'
                          }`}
                          title={`Click to ${isActive ? 'deactivate' : 'activate'} this venue`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="text-zinc-400" />
                              Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 sm:py-4 text-center">
                        <span className="px-2.5 py-1 text-xs rounded-full bg-brand/10 text-brand font-medium">
                          {venue.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 sm:py-4 text-textSecondary text-center mt-2.5">
                        <div className="flex items-center justify-center gap-1.5"><Users size={14} /> {venue.capacity || 'N/A'}</div>
                      </td>
                      <td className="px-3 py-2 sm:py-4 text-textSecondary text-center">
                        {venue.location || 'N/A'}
                      </td>
                      <td className="px-3 py-2 sm:py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            aria-label="Edit venue"
                            className="h-8 w-8 text-textMuted hover:text-brand hover:bg-brand/10"
                            onClick={() => handleOpenModal(venue)}
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            aria-label="Delete venue"
                            className="h-8 w-8 text-textMuted hover:text-error hover:bg-error/10"
                            onClick={() => handleDeleteVenue(venue.id, venue.name)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {venues.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 sm:px-6 border-t border-borderSoft bg-card gap-4">
            <div className="flex items-center text-sm text-textMuted">
              Showing <span className="font-medium mx-1">{startIndex + 1}</span> to <span className="font-medium mx-1">{Math.min(startIndex + itemsPerPage, venues.length)}</span> of <span className="font-medium mx-1">{venues.length}</span> results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVenue ? 'Edit Venue' : 'Add New Venue'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">Venue Name <span className="text-error">*</span></Label>
              <Input 
                id="venue-name"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. CEP 108, OAT"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="venue-category">Category <span className="text-error">*</span></Label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                <SelectTrigger id="venue-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs_approval">Needs Approval (CEPs, LTs, Ground, etc)</SelectItem>
                  <SelectItem value="auto_approval">Auto Approval (OAT, CEPs, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue-capacity">Capacity</Label>
              <Input 
                id="venue-capacity"
                type="number"
                value={formData.capacity} 
                onChange={e => setFormData({ ...formData, capacity: e.target.value })} 
                placeholder="e.g. 60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue-location">Location</Label>
              <Input 
                id="venue-location"
                value={formData.location} 
                onChange={e => setFormData({ ...formData, location: e.target.value })} 
                placeholder="e.g. CEP Building, 1st Floor"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-borderSoft">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-textPrimary">Status (Available for Bookings)</Label>
                <p className="text-xs text-textSecondary">
                  {formData.is_active 
                    ? 'Clubs can view and book this venue.' 
                    : 'Disabled. Clubs cannot select or book this venue.'}
                </p>
              </div>
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={v => setFormData({ ...formData, is_active: v })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSaveVenue}>Save Venue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVenues;

