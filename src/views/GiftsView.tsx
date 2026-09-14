import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getGiftCampaigns,
  getGiftRecipients,
  createGiftCampaign,
  updateGiftCampaign,
  deleteGiftCampaign,
  updateRecipientDelivery,
  getResidents,
  createGiftRecipient,
  addManualGiftRecipient,
  deleteGiftRecipient,
} from '../services/db';
import { GiftCampaign, GiftRecipient, Resident } from '../types';
import { formatCurrencyVND, formatDateVN } from '../utils/numberToWords';
import { exportGiftRecipientsToExcel } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';

export function GiftsView() {
  const { user, userProfile, hasPerm } = useAuth();

  const [campaigns, setCampaigns] = useState<GiftCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<GiftCampaign | null>(null);
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipient Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED' | 'PENDING'>('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');

  // Delivery Modal
  const [activeDeliveryTarget, setActiveDeliveryTarget] = useState<GiftRecipient | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'Trực tiếp' | 'Người thân nhận thay'>('Trực tiếp');
  const [proxyName, setProxyName] = useState('');
  const [proxyId, setProxyId] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  // Create Campaign Modal
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [campName, setCampName] = useState('');
  const [campSponsor, setCampSponsor] = useState('');
  const [campDate, setCampDate] = useState(new Date().toISOString().split('T')[0]);
  const [campGiftType, setCampGiftType] = useState('Gạo 10kg + Nhu yếu phẩm + Tiền mặt 200.000đ');
  const [campUnitValue, setCampUnitValue] = useState<number | ''>(500000);
  const [campTargetGroup, setCampTargetGroup] = useState<'POOR' | 'NEAR_POOR' | 'POLICY' | 'ELDERLY' | 'ALL'>('POOR');
  const [savingCamp, setSavingCamp] = useState(false);

  // Edit Campaign Modal
  const [isEditCampaignOpen, setIsEditCampaignOpen] = useState(false);
  const [editCampName, setEditCampName] = useState('');
  const [editCampSponsor, setEditCampSponsor] = useState('');
  const [editCampDate, setEditCampDate] = useState('');
  const [editCampGiftType, setEditCampGiftType] = useState('');
  const [editCampUnitValue, setEditCampUnitValue] = useState<number | ''>('');
  const [editCampStatus, setEditCampStatus] = useState<'DISTRIBUTING' | 'COMPLETED'>('DISTRIBUTING');
  const [savingEditCamp, setSavingEditCamp] = useState(false);

  // Delete Campaign Confirmation
  const [isDeleteCampOpen, setIsDeleteCampOpen] = useState(false);
  const [deletingCamp, setDeletingCamp] = useState(false);

  // Manual Recipient Modal
  const [isManualRecipientOpen, setIsManualRecipientOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNationalId, setManualNationalId] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualGroup, setManualGroup] = useState('Tổ 1');
  const [manualTargetGroup, setManualTargetGroup] = useState('Hộ nghèo');
  const [manualNotes, setManualNotes] = useState('');
  const [savingManualRecipient, setSavingManualRecipient] = useState(false);

  // Delete Recipient state
  const [recipientToDelete, setRecipientToDelete] = useState<GiftRecipient | null>(null);

  const loadCampaigns = async (preserveId?: string) => {
    setLoading(true);
    try {
      const list = await getGiftCampaigns();
      setCampaigns(list);
      if (list.length > 0) {
        const targetId = preserveId || selectedCampaign?.id;
        const matched = list.find((c) => c.id === targetId) || list[0];
        setSelectedCampaign(matched);
        await loadRecipients(matched.id);
      } else {
        setSelectedCampaign(null);
        setRecipients([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async (campaignId: string) => {
    try {
      const rList = await getGiftRecipients(campaignId);
      setRecipients(rList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleSelectCampaign = async (c: GiftCampaign) => {
    setSelectedCampaign(c);
    await loadRecipients(c.id);
  };

  // Open delivery modal
  const openDeliveryModal = (r: GiftRecipient) => {
    if (r.status === 'DELIVERED') {
      alert('Nhân khẩu này đã được nhận quà trước đó. Không được phát trùng lặp!');
      return;
    }
    setActiveDeliveryTarget(r);
    setDeliveryMethod('Trực tiếp');
    setProxyName('');
    setProxyId('');
    setDeliveryNotes('');
  };

  // Submit delivery
  const handleConfirmDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryTarget || !selectedCampaign) return;

    if (deliveryMethod === 'Người thân nhận thay' && !proxyName.trim()) {
      alert('Vui lòng ghi rõ họ tên người nhận thay.');
      return;
    }

    setConfirmingDelivery(true);
    try {
      await updateRecipientDelivery(
        activeDeliveryTarget.id,
        selectedCampaign.id,
        {
          deliveryMethod,
          proxyName: deliveryMethod === 'Người thân nhận thay' ? proxyName.trim() : undefined,
          proxyNationalId: deliveryMethod === 'Người thân nhận thay' ? proxyId.trim() : undefined,
          notes: deliveryNotes.trim(),
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      setActiveDeliveryTarget(null);
      await loadRecipients(selectedCampaign.id);

      // Refresh campaign stats
      const updatedCampaigns = await getGiftCampaigns();
      setCampaigns(updatedCampaigns);
      const cur = updatedCampaigns.find((c) => c.id === selectedCampaign.id);
      if (cur) setSelectedCampaign(cur);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi xác nhận phát quà.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  // Create Campaign & Populate Eligible Recipients
  const handleCreateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) return;

    setSavingCamp(true);
    try {
      // 1. Fetch eligible residents based on target criteria
      const allResidents = await getResidents();
      let eligible = allResidents;

      if (campTargetGroup === 'POOR') {
        eligible = allResidents.filter((r) => r.isPoorHousehold);
      } else if (campTargetGroup === 'NEAR_POOR') {
        eligible = allResidents.filter((r) => r.isNearPoorHousehold || r.isPoorHousehold);
      } else if (campTargetGroup === 'POLICY') {
        eligible = allResidents.filter((r) => r.isPolicyBeneficiary);
      } else if (campTargetGroup === 'ELDERLY') {
        eligible = allResidents.filter((r) => r.isElderly);
      }

      const totalQty = Math.max(1, eligible.length);
      const unitVal = Number(campUnitValue) || 0;

      // 2. Create campaign document
      const newCamp = await createGiftCampaign(
        {
          campaignName: campName.trim(),
          sponsor: campSponsor.trim() || 'UBND Xã & Nhà hảo tâm',
          distributionDate: campDate,
          giftType: campGiftType.trim(),
          unitValue: unitVal,
          totalBudget: totalQty * unitVal,
          totalQuantity: totalQty,
          status: 'DISTRIBUTING',
          targetCriteria: [
            campTargetGroup === 'POOR'
              ? 'Hộ nghèo'
              : campTargetGroup === 'NEAR_POOR'
              ? 'Hộ cận nghèo'
              : campTargetGroup === 'POLICY'
              ? 'Chính sách'
              : campTargetGroup === 'ELDERLY'
              ? 'Người cao tuổi'
              : 'Toàn dân',
          ],
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      // 3. Populate recipient records
      for (const res of eligible) {
        await createGiftRecipient({
          campaignId: newCamp.id,
          campaignCode: newCamp.campaignCode,
          residentId: res.id,
          residentName: res.fullName,
          nationalId: res.nationalId,
          householdCode: res.householdCode,
          groupNumber: res.groupNumber,
          address: res.address,
          phone: res.phone,
          status: 'PENDING',
          isProxyAllowed: true,
        });
      }

      setIsCreateCampaignOpen(false);
      await loadCampaigns();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi tạo đợt phát quà');
    } finally {
      setSavingCamp(false);
    }
  };

  // Open Edit Campaign modal
  const openEditCampaign = (camp?: GiftCampaign) => {
    const target = camp || selectedCampaign;
    if (!target) return;
    if (camp && camp.id !== selectedCampaign?.id) {
      setSelectedCampaign(camp);
      loadRecipients(camp.id);
    }
    setEditCampName(target.campaignName);
    setEditCampSponsor(target.sponsor);
    setEditCampDate(target.distributionDate || new Date().toISOString().split('T')[0]);
    setEditCampGiftType(target.giftType);
    setEditCampUnitValue(target.unitValue || 0);
    setEditCampStatus(target.status === 'COMPLETED' ? 'COMPLETED' : 'DISTRIBUTING');
    setIsEditCampaignOpen(true);
  };

  // Open Delete Campaign modal
  const openDeleteCampaign = (camp?: GiftCampaign) => {
    const target = camp || selectedCampaign;
    if (!target) return;
    if (camp && camp.id !== selectedCampaign?.id) {
      setSelectedCampaign(camp);
      loadRecipients(camp.id);
    }
    setIsDeleteCampOpen(true);
  };

  // Submit Edit Campaign
  const handleUpdateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !editCampName.trim()) return;
    setSavingEditCamp(true);
    try {
      const uVal = Number(editCampUnitValue) || 0;
      await updateGiftCampaign(
        selectedCampaign.id,
        {
          campaignName: editCampName.trim(),
          sponsor: editCampSponsor.trim(),
          distributionDate: editCampDate,
          giftType: editCampGiftType.trim(),
          unitValue: uVal,
          status: editCampStatus,
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setIsEditCampaignOpen(false);
      await loadCampaigns(selectedCampaign.id);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi cập nhật đợt quà.');
    } finally {
      setSavingEditCamp(false);
    }
  };

  // Submit Delete Campaign
  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;
    setDeletingCamp(true);
    try {
      await deleteGiftCampaign(
        selectedCampaign.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setIsDeleteCampOpen(false);
      setSelectedCampaign(null);
      await loadCampaigns();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi xóa đợt quà.');
    } finally {
      setDeletingCamp(false);
    }
  };

  // Submit Add Manual Recipient
  const handleAddManualRecipient = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !manualName.trim() || !manualAddress.trim()) {
      alert('Vui lòng nhập đầy đủ họ tên và địa chỉ người nhận quà.');
      return;
    }
    setSavingManualRecipient(true);
    try {
      await addManualGiftRecipient(
        {
          campaignId: selectedCampaign.id,
          recipientName: manualName.trim(),
          nationalId: manualNationalId.trim(),
          phone: manualPhone.trim(),
          address: manualAddress.trim(),
          groupNumber: manualGroup.trim(),
          targetGroupTag: manualTargetGroup,
          giftItemName: selectedCampaign.giftType,
          quantity: 1,
          unitValue: selectedCampaign.unitValue || 0,
          totalValue: selectedCampaign.unitValue || 0,
          notes: manualNotes.trim(),
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      setIsManualRecipientOpen(false);
      setManualName('');
      setManualNationalId('');
      setManualPhone('');
      setManualAddress('');
      setManualNotes('');
      await loadRecipients(selectedCampaign.id);

      // Refresh campaigns counts
      const updatedCampaigns = await getGiftCampaigns();
      setCampaigns(updatedCampaigns);
      const cur = updatedCampaigns.find((c) => c.id === selectedCampaign.id);
      if (cur) setSelectedCampaign(cur);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi thêm người nhận quà.');
    } finally {
      setSavingManualRecipient(false);
    }
  };

  // Delete recipient
  const handleDeleteRecipient = async () => {
    if (!recipientToDelete || !selectedCampaign) return;
    try {
      await deleteGiftRecipient(
        recipientToDelete.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setRecipientToDelete(null);
      await loadRecipients(selectedCampaign.id);

      const updatedCampaigns = await getGiftCampaigns();
      setCampaigns(updatedCampaigns);
      const cur = updatedCampaigns.find((c) => c.id === selectedCampaign.id);
      if (cur) setSelectedCampaign(cur);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Lỗi khi xóa người nhận quà.');
    }
  };

  // Dynamic available groups
  const availableGroups = useMemo(() => {
    const base = ['Tổ 1', 'Tổ 2', 'Tổ 3', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8'];
    const fromRecip = recipients.map((r) => r.groupNumber).filter(Boolean);
    return Array.from(new Set([...base, ...fromRecip]));
  }, [recipients]);

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (statusFilter === 'DELIVERED' && r.status !== 'DELIVERED') return false;
      if (statusFilter === 'PENDING' && r.status !== 'PENDING') return false;
      if (groupFilter !== 'ALL' && r.groupNumber !== groupFilter) return false;

      if (search) {
        const s = search.toLowerCase();
        const rName = (r.residentName || r.recipientName || '').toLowerCase();
        const match =
          rName.includes(s) ||
          (r.nationalId && r.nationalId.includes(s)) ||
          (r.householdCode && r.householdCode.toLowerCase().includes(s)) ||
          (r.address && r.address.toLowerCase().includes(s));
        if (!match) return false;
      }
      return true;
    });
  }, [recipients, statusFilter, groupFilter, search]);

  const deliveredCount = recipients.filter((r) => r.status === 'DELIVERED').length;
  const pendingCount = recipients.filter((r) => r.status === 'PENDING').length;
  const progressPct =
    recipients.length > 0 ? Math.round((deliveredCount / recipients.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-high pb-4">
        <div>
          <h2 className="font-headline-lg font-bold text-on-surface">
            Quản Lý Phát Quà & Cứu Trợ An Sinh Xã Hội
          </h2>
          <p className="text-xs text-on-surface-variant">
            Điều phối các đợt phát quà từ thiện, chống trùng lặp và xuất danh sách ký nhận chuẩn
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedCampaign && hasPerm('gifts.export') && (
            <button
              onClick={() =>
                exportGiftRecipientsToExcel(
                  filteredRecipients,
                  selectedCampaign.campaignName,
                  `Danh_sach_ky_nhan_${selectedCampaign.campaignCode}.xlsx`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-base text-emerald-700">file_download</span>
              <span>Xuất ds ký nhận (.xlsx)</span>
            </button>
          )}

          {hasPerm('gifts.create') && (
            <button
              onClick={() => setIsCreateCampaignOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-98"
            >
              <span className="material-symbols-outlined text-base">add_box</span>
              <span>Tạo đợt phát quà</span>
            </button>
          )}
        </div>
      </div>

      {/* Campaigns Selector Chips / Carousel */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {campaigns.map((c) => (
          <div
            key={c.id}
            onClick={() => handleSelectCampaign(c)}
            className={`group relative flex items-start gap-3 p-3.5 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
              selectedCampaign?.id === c.id
                ? 'bg-surface-container-lowest border-primary shadow-xs ring-2 ring-primary/20'
                : 'bg-surface-container-low border-surface-container-high hover:border-outline/40'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">featured_seasonal_and_gifts</span>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-primary bg-primary-fixed px-1.5 py-0.5 rounded-sm">
                    {c.campaignCode}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {formatDateVN(c.distributionDate)}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCampaign(c);
                    }}
                    className="p-1 rounded-md hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                    title="Chỉnh sửa đợt phát quà"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteCampaign(c);
                    }}
                    className="p-1 rounded-md hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-colors"
                    title="Xóa đợt phát quà"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-xs text-on-surface mt-1 truncate max-w-[200px]">
                {c.campaignName}
              </h4>
              <div className="text-[11px] text-on-surface-variant mt-0.5">
                {c.deliveredCount || 0}/{c.totalQuantity} suất đã phát
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Campaign Detail Box */}
      {selectedCampaign && (
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high pb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-md">
                  {selectedCampaign.campaignCode}
                </span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                  selectedCampaign.status === 'COMPLETED' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedCampaign.status === 'COMPLETED' ? '✓ Đã hoàn thành' : '⚡ Đang triển khai'}
                </span>

                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <button
                    onClick={() => setIsManualRecipientOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
                    title="Thêm người nhận quà bằng tay"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>Thêm người nhận</span>
                  </button>
                  <button
                    onClick={() => openEditCampaign(selectedCampaign)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors"
                    title="Chỉnh sửa đợt phát quà"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">edit</span>
                    <span>Chỉnh sửa đợt</span>
                  </button>
                  <button
                    onClick={() => openDeleteCampaign(selectedCampaign)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container/30 hover:bg-error-container/60 text-error text-xs font-semibold transition-colors"
                    title="Xóa đợt phát quà"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Xóa đợt quà</span>
                  </button>
                </div>
              </div>
              <h3 className="font-headline-sm font-bold text-on-surface mt-1.5">
                {selectedCampaign.campaignName}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Đơn vị tài trợ: <span className="font-semibold text-slate-800">{selectedCampaign.sponsor}</span> • Phần quà: <span className="font-medium text-slate-700">{selectedCampaign.giftType}</span> ({formatCurrencyVND(selectedCampaign.unitValue)}/suất)
              </p>
            </div>

            {/* Campaign Progress Gauge */}
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-surface-container-high min-w-[240px]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-on-surface-variant font-medium">Tiến độ cấp phát:</span>
                <span className="font-bold text-primary font-numeric-data">
                  {deliveredCount} / {recipients.length} ({progressPct}%)
                </span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                <span>Còn lại: {pendingCount} suất</span>
                <span>Ngân sách: {formatCurrencyVND(selectedCampaign.totalBudget)}</span>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm người nhận quà theo họ tên, CCCD, Mã hộ..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium text-on-surface"
            >
              <option value="ALL">Tất cả Tổ dân cư</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Filter Status buttons */}
            <div className="flex gap-1 bg-surface-container p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'ALL'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant'
                }`}
              >
                Tất cả ({recipients.length})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-800 text-white shadow-2xs'
                    : 'text-on-surface-variant'
                }`}
              >
                Chưa nhận ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('DELIVERED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'DELIVERED'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-on-surface-variant'
                }`}
              >
                Đã nhận ({deliveredCount})
              </button>
            </div>
          </div>

          {/* Recipients Table */}
          <div className="rounded-2xl border border-surface-container-high overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-semibold">
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-4">Họ và tên người nhận</th>
                    <th className="py-3 px-4">CCCD</th>
                    <th className="py-3 px-4">Tổ / Mã hộ</th>
                    <th className="py-3 px-4">Địa chỉ cư trú</th>
                    <th className="py-3 px-4">Trạng thái phát</th>
                    <th className="py-3 px-4">Hình thức nhận</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                        Không có người nhận nào trong danh sách.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3 px-4 text-center font-medium text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-on-surface">
                            {r.recipientName || r.residentName}
                          </div>
                          {r.phone && <div className="text-[11px] text-slate-500">{r.phone}</div>}
                          {r.targetGroupTag && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                              {r.targetGroupTag}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {r.nationalId || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{r.groupNumber}</span>
                          {r.householdCode && (
                            <div className="text-[10px] font-mono text-primary">{r.householdCode}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 truncate max-w-xs">{r.address}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              r.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status === 'DELIVERED' ? '✓ Đã nhận quà' : '⏳ Chưa nhận'}
                          </span>
                          {r.deliveredAt && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(r.deliveredAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {r.status === 'DELIVERED' ? (
                            <div>
                              <div className="font-medium text-slate-800">
                                {r.deliveryMethod || 'Trực tiếp'}
                              </div>
                              {r.proxyName && (
                                <div className="text-[10px] text-amber-800">
                                  Thay: {r.proxyName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === 'PENDING' && hasPerm('gifts.distribute') && (
                              <button
                                onClick={() => openDeliveryModal(r)}
                                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white text-[11px] font-semibold transition-all shadow-xs"
                              >
                                Xác nhận phát
                              </button>
                            )}
                            {r.status === 'DELIVERED' && (
                              <span className="text-[11px] text-emerald-700 font-semibold italic">
                                Đã lưu sổ
                              </span>
                            )}
                            {hasPerm('gifts.create') && (
                              <button
                                onClick={() => setRecipientToDelete(r)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                title="Xóa người nhận khỏi đợt quà"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delivery */}
      {activeDeliveryTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Xác nhận trao quà an sinh
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Ghi nhận biên bản nhận quà cho nhân khẩu
                </p>
              </div>
              <button
                onClick={() => setActiveDeliveryTarget(null)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmDelivery} className="p-6 space-y-4">
              <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high text-xs space-y-1">
                <div className="font-bold text-sm text-on-surface">
                  {activeDeliveryTarget.residentName}
                </div>
                <div>CCCD: {activeDeliveryTarget.nationalId || 'Chưa cập nhật'}</div>
                <div>
                  {activeDeliveryTarget.groupNumber} • {activeDeliveryTarget.address}
                </div>
                <div className="text-primary font-semibold pt-1">
                  Đợt quà: {selectedCampaign?.campaignName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Hình thức người nhận
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('Trực tiếp')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      deliveryMethod === 'Trực tiếp'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    Nhận trực tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('Người thân nhận thay')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      deliveryMethod === 'Người thân nhận thay'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    Người thân nhận thay
                  </button>
                </div>
              </div>

              {deliveryMethod === 'Người thân nhận thay' && (
                <div className="space-y-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">
                      Họ tên người nhận thay <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={proxyName}
                      onChange={(e) => setProxyName(e.target.value)}
                      placeholder="Ví dụ: Lê Thị Bảy (Con gái)"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">
                      Số CCCD / Điện thoại người nhận thay
                    </label>
                    <input
                      type="text"
                      value={proxyId}
                      onChange={(e) => setProxyId(e.target.value)}
                      placeholder="Số CCCD hoặc SĐT"
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Ghi chú trao tặng
                </label>
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Ghi chú thêm nếu cần..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setActiveDeliveryTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={confirmingDelivery}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                >
                  {confirmingDelivery ? 'Đang lưu...' : 'Xác nhận đã phát quà'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Campaign */}
      {isCreateCampaignOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Khởi tạo Đợt Phát Quà An Sinh
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Hệ thống tự động lọc danh sách nhân khẩu đủ điều kiện nhận
                </p>
              </div>
              <button
                onClick={() => setIsCreateCampaignOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Tên chương trình / Đợt quà <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="Ví dụ: Chương trình Quà Tết Ất Tỵ 2026"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Đơn vị tài trợ / Nhà hảo tâm
                  </label>
                  <input
                    type="text"
                    value={campSponsor}
                    onChange={(e) => setCampSponsor(e.target.value)}
                    placeholder="UBND Xã & Kiều bào"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Ngày triển khai
                  </label>
                  <input
                    type="date"
                    required
                    value={campDate}
                    onChange={(e) => setCampDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Nội dung phần quà trao tặng
                </label>
                <input
                  type="text"
                  required
                  value={campGiftType}
                  onChange={(e) => setCampGiftType(e.target.value)}
                  placeholder="Ví dụ: Gạo 10kg, dầu ăn, đường và tiền mặt..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Trị giá ước tính mỗi suất (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={campUnitValue}
                    onChange={(e) =>
                      setCampUnitValue(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Đối tượng thụ hưởng
                  </label>
                  <select
                    value={campTargetGroup}
                    onChange={(e) =>
                      setCampTargetGroup(
                        e.target.value as 'POOR' | 'NEAR_POOR' | 'POLICY' | 'ELDERLY' | 'ALL'
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium"
                  >
                    <option value="POOR">Chỉ Hộ nghèo</option>
                    <option value="NEAR_POOR">Hộ nghèo & Cận nghèo</option>
                    <option value="POLICY">Gia đình chính sách</option>
                    <option value="ELDERLY">Người cao tuổi (≥60)</option>
                    <option value="ALL">Toàn thể nhân khẩu</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container text-xs text-on-surface-variant">
                Sau khi nhấn Tạo đợt phát quà, hệ thống sẽ tự động đối chiếu cơ sở dữ liệu dân cư
                và lập danh sách nhận quà đầy đủ.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsCreateCampaignOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingCamp}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                >
                  {savingCamp ? 'Đang khởi tạo...' : 'Tạo đợt phát quà'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Campaign */}
      {isEditCampaignOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Chỉnh Sửa Đợt Phát Quà
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Cập nhật thông tin đợt quà ({selectedCampaign.campaignCode})
                </p>
              </div>
              <button
                onClick={() => setIsEditCampaignOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Tên chương trình / Đợt quà <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCampName}
                  onChange={(e) => setEditCampName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Đơn vị tài trợ / Nhà hảo tâm
                  </label>
                  <input
                    type="text"
                    value={editCampSponsor}
                    onChange={(e) => setEditCampSponsor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Ngày triển khai
                  </label>
                  <input
                    type="date"
                    required
                    value={editCampDate}
                    onChange={(e) => setEditCampDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Nội dung phần quà trao tặng
                </label>
                <input
                  type="text"
                  required
                  value={editCampGiftType}
                  onChange={(e) => setEditCampGiftType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Trị giá ước tính mỗi suất (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={editCampUnitValue}
                    onChange={(e) =>
                      setEditCampUnitValue(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Trạng thái triển khai
                  </label>
                  <select
                    value={editCampStatus}
                    onChange={(e) =>
                      setEditCampStatus(e.target.value as 'DISTRIBUTING' | 'COMPLETED')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium"
                  >
                    <option value="DISTRIBUTING">Đang triển khai</option>
                    <option value="COMPLETED">Hoàn thành đợt</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCampaignOpen(false);
                    setIsDeleteCampOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Xóa đợt quà này</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditCampaignOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditCamp}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                  >
                    {savingEditCamp ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Manual Recipient */}
      {isManualRecipientOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Thêm Người Nhận Quà Thủ Công
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Bổ sung cử tri / người dân vào đợt quà: {selectedCampaign.campaignName}
                </p>
              </div>
              <button
                onClick={() => setIsManualRecipientOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddManualRecipient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Họ và tên người nhận <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="NGUYỄN VĂN A"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs uppercase focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    value={manualNationalId}
                    onChange={(e) => setManualNationalId(e.target.value)}
                    placeholder="079..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="0918..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tổ dân cư
                  </label>
                  <input
                    type="text"
                    list="manualGroupList"
                    required
                    value={manualGroup}
                    onChange={(e) => setManualGroup(e.target.value)}
                    placeholder="VD: Tổ 1"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                  <datalist id="manualGroupList">
                    {availableGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Nhóm đối tượng
                  </label>
                  <select
                    value={manualTargetGroup}
                    onChange={(e) => setManualTargetGroup(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium"
                  >
                    <option value="Hộ nghèo">Hộ nghèo</option>
                    <option value="Hộ cận nghèo">Hộ cận nghèo</option>
                    <option value="Chính sách">Gia đình chính sách</option>
                    <option value="Người cao tuổi">Người cao tuổi</option>
                    <option value="Khuyết tật">Người khuyết tật</option>
                    <option value="Khác">Khác / Khó khăn đột xuất</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Địa chỉ thường trú / Nơi ở hiện tại <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Số 123, Đường số 1..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Ghi chú hoàn cảnh hoặc người chỉ định..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsManualRecipientOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingManualRecipient}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                >
                  {savingManualRecipient ? 'Đang thêm...' : 'Thêm vào danh sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Campaign */}
      <ConfirmModal
        isOpen={isDeleteCampOpen}
        title="Xóa đợt phát quà"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa đợt phát quà "${selectedCampaign?.campaignName}" (${selectedCampaign?.campaignCode})? Tất cả danh sách người nhận liên quan trong đợt này sẽ bị xóa cùng.`}
        confirmText={deletingCamp ? 'Đang xóa...' : 'Xác nhận xóa'}
        onConfirm={handleDeleteCampaign}
        onCancel={() => setIsDeleteCampOpen(false)}
      />

      {/* Confirm Delete Recipient */}
      <ConfirmModal
        isOpen={!!recipientToDelete}
        title="Xóa người nhận quà"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa người nhận "${recipientToDelete?.recipientName || recipientToDelete?.residentName}" khỏi danh sách đợt quà này?`}
        confirmText="Xóa khỏi danh sách"
        onConfirm={handleDeleteRecipient}
        onCancel={() => setRecipientToDelete(null)}
      />
    </div>
  );
}
