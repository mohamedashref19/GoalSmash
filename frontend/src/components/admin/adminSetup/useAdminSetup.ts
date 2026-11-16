import React, { useEffect, useState } from "react";
import {
  blockCourtSlots,
  createCourtByAdmin,
  createEmployeeAccount,
  createOwnerAccount,
  createPaymentAccount,
  createVenueByAdmin,
  deleteCourtBlock,
  deleteCourtBlockSeries,
  deleteEmployeeAccount,
  deletePaymentAccount,
  deleteVenueRequest,
  fetchAllCustomers,
  fetchAllEmployees,
  fetchAllOwners,
  fetchAllVenues,
  fetchCourtBlocks,
  fetchPaymentAccounts,
  fetchVenueRequests,
  togglePaymentAccount,
  updateCourtByAdmin,
  updatePaymentAccount,
  updateVenueByAdmin,
  updateVenueRequestStatus,
  // @ts-expect-error: API lacks TypeScript definitions
} from "@/api/adminApi";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchCourts } from "@/api/courtApi";
import { toast } from "sonner";
import { useConfirm } from "@/components/venue/useConfirm";
import type {
  Court,
  CourtBlock,
  Customer,
  Employee,
  Owner,
  PaymentAccount,
  TabKey,
  Venue,
  VenueRequest,
} from "./types";
import { calculateHours, getScheduleError } from "./helpers";

export function useAdminSetup() {
  const [activeTab, setActiveTab] = useState<TabKey>("owner");

  const [ownersList, setOwnersList] = useState<Owner[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [venuesList, setVenuesList] = useState<Venue[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [accountsList, setAccountsList] = useState<PaymentAccount[]>([]);
  const [blocksList, setBlocksList] = useState<CourtBlock[]>([]);
  const [venueRequestsList, setVenueRequestsList] = useState<VenueRequest[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { confirm, ConfirmDialog } = useConfirm();

  const [blockData, setBlockData] = useState({
    venueId: "",
    courtId: "",
    dateFrom: "",
    dateTo: "",
    startTimeHour: "08",
    endTimeHour: "10",
    blockType: "maintenance",
    notes: "",
  });

  const [dynamicCourts, setDynamicCourts] = useState<Court[]>([]);
  const [isBlocking, setIsBlocking] = useState(false);

  const [ownerData, setOwnerData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });

  const [employeeData, setEmployeeData] = useState({
    venue: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });

  const [venueData, setVenueData] = useState({
    name: "",
    phone: "",
    city: "Alexandria",
    area: "",
    locationUrl: "",
    ownerId: "",
    openTime: "08:00",
    closeTime: "02:00",
    eveningStartTime: "18:00",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
  });

  const [venueImage, setVenueImage] = useState<File | null>(null);

  const [courtData, setCourtData] = useState({
    venueId: "",
    name: "",
    sportType: "padel",
    priceMorning: "",
    priceEvening: "",
    locationUrl: "",
  });

  const [courtImages, setCourtImages] = useState<File[]>([]);

  const [accountData, setAccountData] = useState({
    type: "vodafone_cash",
    identifier: "",
    accountName: "",
  });

  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({
    type: "vodafone_cash",
    identifier: "",
    accountName: "",
  });

  const [editVenueId, setEditVenueId] = useState<string | null>(null);
  const [editVenueForm, setEditVenueForm] = useState({
    name: "",
    phone: "",
    area: "",
    details: "",
    locationUrl: "",
    ownerId: "",
    openTime: "08:00",
    closeTime: "02:00",
    eveningStartTime: "18:00",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
  });

  const [editVenueImage, setEditVenueImage] = useState<File | null>(null);

  const [editCourtId, setEditCourtId] = useState<string | null>(null);
  const [editCourtForm, setEditCourtForm] = useState({
    name: "",
    sportType: "padel",
    priceMorning: "",
    priceEvening: "",
    locationUrl: "",
  });

  const [editCourtExistingImages, setEditCourtExistingImages] = useState<string[]>([]);
  const [editCourtImages, setEditCourtImages] = useState<File[]>([]);

  const loadVenues = async () => {
    try {
      setVenuesList(await fetchAllVenues());
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const loadOwners = async () => {
    try {
      setOwnersList(await fetchAllOwners());
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      setEmployeesList(await fetchAllEmployees());
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      setAccountsList(await fetchPaymentAccounts());
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const loadBlocks = async () => {
    try {
      setBlocksList(await fetchCourtBlocks());
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const loadVenueRequests = async () => {
    setLoading(true);
    try {
      setVenueRequestsList(await fetchVenueRequests());
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      (activeTab === "venue" || activeTab === "manage" || activeTab === "block") &&
      ownersList.length === 0
    )
      loadOwners();
    if (
      (activeTab === "court" ||
        activeTab === "manage" ||
        activeTab === "block" ||
        activeTab === "employees") &&
      venuesList.length === 0
    )
      loadVenues();
    if (activeTab === "employees" && employeesList.length === 0) {
      loadEmployees();
    }
    if (activeTab === "block" && blocksList.length === 0) {
      loadBlocks();
    }
    if (activeTab === "customers" && customersList.length === 0) {
      setLoading(true);
      fetchAllCustomers()
        .then(setCustomersList)
        .catch((err: unknown) => toast.error(err as string))
        .finally(() => setLoading(false));
    }
    if (activeTab === "accounts" && accountsList.length === 0) loadAccounts();
    if (activeTab === "requests" && venueRequestsList.length === 0) loadVenueRequests();
  }, [
    activeTab,
    customersList.length,
    ownersList.length,
    employeesList.length,
    venuesList.length,
    accountsList.length,
    blocksList.length,
    venueRequestsList.length,
  ]);

  useEffect(() => {
    if (blockData.venueId) {
      fetchCourts(blockData.venueId)
        .then(setDynamicCourts)
        .catch(() => toast.error("فشل جلب ملاعب النادي المختار"));
    } else {
      setDynamicCourts([]);
    }
  }, [blockData.venueId]);

  const handleCreateOwner = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (ownerData.password !== ownerData.passwordConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      await createOwnerAccount(ownerData);
      toast.success("تم إنشاء حساب المالك بنجاح");
      setOwnerData({ name: "", email: "", phone: "", password: "", passwordConfirm: "" });
      setOwnersList([]);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!employeeData.venue) {
      toast.error("يرجى اختيار النادي التابع له الموظف");
      return;
    }
    if (employeeData.password !== employeeData.passwordConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      await createEmployeeAccount(employeeData);
      toast.success("تم إنشاء حساب الموظف وربطه بالنادي بنجاح");
      setEmployeeData({
        venue: "",
        name: "",
        email: "",
        phone: "",
        password: "",
        passwordConfirm: "",
      });
      loadEmployees();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const isConfirmed = await confirm("هل أنت متأكد من حذف حساب هذا الموظف نهائياً؟");
    if (isConfirmed) {
      try {
        await deleteEmployeeAccount(id);
        toast.success("تم حذف الموظف بنجاح");
        loadEmployees();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    const scheduleError = getScheduleError(
      venueData.openTime,
      venueData.eveningStartTime,
      venueData.closeTime,
    );
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    setLoading(true);
    try {
      const computedHours = calculateHours(venueData.openTime, venueData.closeTime);

      const formData = new FormData();
      formData.append("name", venueData.name);
      formData.append("phone", venueData.phone);
      formData.append("address[city]", venueData.city);
      formData.append("address[area]", venueData.area);
      formData.append("locationUrl", venueData.locationUrl.trim());
      formData.append("owner", venueData.ownerId);

      formData.append("openTime", venueData.openTime);
      formData.append("closeTime", venueData.closeTime);
      formData.append("eveningStartTime", venueData.eveningStartTime);
      formData.append("operatingHours", String(computedHours));

      venueData.workingDays.forEach((day) => formData.append("workingDays[]", String(day)));

      if (venueImage) formData.append("image", venueImage);
      await createVenueByAdmin(formData);
      toast.success("تم إنشاء النادي بنجاح");
      setVenueData({
        name: "",
        phone: "",
        city: "Alexandria",
        area: "",
        locationUrl: "",
        ownerId: "",
        openTime: "08:00",
        closeTime: "02:00",
        eveningStartTime: "18:00",
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      });
      setVenueImage(null);
      setVenuesList([]);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    const isConfirmed = await confirm("هل أنت متأكد من فتح هذا الموعد للعملاء؟");
    if (isConfirmed) {
      try {
        await deleteCourtBlock(id);
        toast.success("تم إعادة فتح الموعد بنجاح");
        loadBlocks();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  const handleDeleteBlockSeries = async (recurrenceId: string) => {
    const isConfirmed = await confirm("هل أنت متأكد من إلغاء هذه السلسلة بالكامل (كل الأيام)؟");
    if (isConfirmed) {
      try {
        await deleteCourtBlockSeries(recurrenceId);
        toast.success("تم إعادة فتح المواعيد بالكامل بنجاح");
        loadBlocks();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courtImages.length > 5) {
      toast.error("الحد الأقصى لصور الملعب هو 5 صور");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", courtData.name);
      formData.append("sportType", courtData.sportType);
      formData.append("priceMorning", courtData.priceMorning);
      formData.append("priceEvening", courtData.priceEvening);
      formData.append("locationUrl", courtData.locationUrl.trim());
      formData.append("venue", courtData.venueId);

      courtImages.forEach((file) => {
        formData.append("images", file);
      });

      await createCourtByAdmin(formData);
      toast.success("تم إضافة الملعب للنادي بنجاح");
      setCourtData({
        venueId: "",
        name: "",
        sportType: "padel",
        priceMorning: "",
        priceEvening: "",
        locationUrl: "",
      });
      setCourtImages([]);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPaymentAccount(accountData);
      toast.success("تم إضافة حساب الدفع بنجاح");
      setAccountData({ type: "vodafone_cash", identifier: "", accountName: "" });
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccount = async (id: string) => {
    try {
      await togglePaymentAccount(id);
      toast.success("تم تغيير حالة الحساب بنجاح");
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const startEditAccount = (acc: PaymentAccount) => {
    setEditAccountId(acc._id);
    setEditAccountForm({
      type: acc.type,
      identifier: acc.identifier,
      accountName: acc.accountName,
    });
  };

  const handleUpdateAccount = async (id: string) => {
    try {
      await updatePaymentAccount(id, editAccountForm);
      toast.success("تم تعديل الحساب بنجاح");
      setEditAccountId(null);
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const isConfirmed = await confirm(
      "هل أنت متأكد من حذف هذا الحساب نهائياً؟ لا يمكن التراجع عن هذه الخطوة.",
    );
    if (isConfirmed) {
      try {
        await deletePaymentAccount(id);
        toast.success("تم حذف الحساب بنجاح");
        loadAccounts();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  const startEditVenue = (venue: Venue) => {
    setEditVenueId(venue._id);
    setEditVenueImage(null);
    setEditVenueForm({
      name: venue.name,
      phone: venue.phone,
      area: venue.address?.area || "",
      details: venue.address?.details || "",
      locationUrl: venue.locationUrl || "",
      ownerId: venue.owner?._id || "",
      openTime: venue.openTime || "08:00",
      closeTime: venue.closeTime || "02:00",
      eveningStartTime: venue.eveningStartTime || "18:00",
      workingDays: venue.workingDays || [0, 1, 2, 3, 4, 5, 6],
    });
  };

  const saveEditVenue = async (id: string) => {
    const scheduleError = getScheduleError(
      editVenueForm.openTime,
      editVenueForm.eveningStartTime,
      editVenueForm.closeTime,
    );
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    try {
      const computedHours = calculateHours(editVenueForm.openTime, editVenueForm.closeTime);

      const formData = new FormData();
      formData.append("name", editVenueForm.name);
      formData.append("phone", editVenueForm.phone);
      formData.append("address[city]", "Alexandria");
      formData.append("address[area]", editVenueForm.area);
      formData.append("locationUrl", editVenueForm.locationUrl.trim());

      formData.append("openTime", editVenueForm.openTime);
      formData.append("closeTime", editVenueForm.closeTime);
      formData.append("eveningStartTime", editVenueForm.eveningStartTime);
      formData.append("operatingHours", String(computedHours));

      editVenueForm.workingDays.forEach((day) => formData.append("workingDays[]", String(day)));

      if (editVenueForm.details) formData.append("address[details]", editVenueForm.details);
      formData.append("owner", editVenueForm.ownerId);
      if (editVenueImage) formData.append("image", editVenueImage);
      await updateVenueByAdmin(id, formData);
      toast.success("تم تحديث بيانات النادي بنجاح");
      setEditVenueId(null);
      setEditVenueImage(null);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const startEditCourt = (court: Court) => {
    setEditCourtId(court._id);
    setEditCourtImages([]);
    const currentImgs =
      court.images && court.images.length > 0 ? court.images : court.image ? [court.image] : [];
    setEditCourtExistingImages(currentImgs);

    setEditCourtForm({
      name: court.name,
      sportType: court.sportType,
      priceMorning: String(court.priceMorning || court.pricePerHour || 0),
      priceEvening: String(court.priceEvening || court.pricePerHour || 0),
      locationUrl: court.locationUrl || "",
    });
  };

  const saveEditCourt = async (id: string) => {
    if (editCourtExistingImages.length + editCourtImages.length > 5) {
      toast.error("إجمالي صور الملعب (الحالية + الجديدة) لا يمكن أن يتجاوز 5 صور");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("name", editCourtForm.name);
      formData.append("priceMorning", String(editCourtForm.priceMorning));
      formData.append("priceEvening", String(editCourtForm.priceEvening));
      formData.append("sportType", editCourtForm.sportType);
      formData.append("locationUrl", editCourtForm.locationUrl.trim());

      formData.append("existingImages", JSON.stringify(editCourtExistingImages));

      editCourtImages.forEach((file) => {
        formData.append("images", file);
      });

      await updateCourtByAdmin(id, formData);
      toast.success("تم تحديث بيانات وصور الملعب بنجاح");
      setEditCourtId(null);
      setEditCourtImages([]);
      setEditCourtExistingImages([]);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleBlockSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockData.venueId || !blockData.courtId || !blockData.dateFrom) {
      toast.error("يرجى تحديد النادي، الملعب، وتاريخ البداية على الأقل.");
      return;
    }

    const startHr = parseInt(blockData.startTimeHour, 10);
    const endHr = parseInt(blockData.endTimeHour, 10);
    if (startHr === endHr) {
      toast.error("وقت البداية لا يمكن أن يساوي وقت النهاية.");
      return;
    }

    setIsBlocking(true);
    try {
      const datesToBlock: string[] = [];
      const currentDate = new Date(blockData.dateFrom);
      const endDate = blockData.dateTo ? new Date(blockData.dateTo) : new Date(blockData.dateFrom);

      while (currentDate <= endDate) {
        datesToBlock.push(currentDate.toISOString().slice(0, 10));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const response = await blockCourtSlots({
        venue: blockData.venueId,
        court: blockData.courtId,
        dates: datesToBlock,
        startTimeHour: startHr,
        endTimeHour: endHr,
        blockType: blockData.blockType,
        notes: blockData.notes,
      });

      toast.success(
        response.message || `تم إغلاق المواعيد بنجاح من ${startHr}:00 إلى ${endHr}:00.`,
      );

      setBlockData({
        venueId: "",
        courtId: "",
        dateFrom: "",
        dateTo: "",
        startTimeHour: "08",
        endTimeHour: "10",
        blockType: "maintenance",
        notes: "",
      });
      setDynamicCourts([]);
      loadBlocks();
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUpdateVenueRequestStatus = async (id: string, status: string) => {
    try {
      await updateVenueRequestStatus(id, status);
      toast.success("تم تحديث حالة الطلب");
      loadVenueRequests();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleDeleteVenueRequest = async (id: string) => {
    const isConfirmed = await confirm("هل أنت متأكد من حذف هذا الطلب؟");
    if (isConfirmed) {
      try {
        await deleteVenueRequest(id);
        toast.success("تم حذف الطلب بنجاح");
        loadVenueRequests();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  return {
    activeTab,
    setActiveTab,
    ownersList,
    setOwnersList,
    employeesList,
    setEmployeesList,
    venuesList,
    setVenuesList,
    customersList,
    setCustomersList,
    accountsList,
    setAccountsList,
    blocksList,
    setBlocksList,
    venueRequestsList,
    setVenueRequestsList,
    expandedBlocks,
    setExpandedBlocks,
    loading,
    setLoading,
    confirm,
    ConfirmDialog,
    blockData,
    setBlockData,
    dynamicCourts,
    setDynamicCourts,
    isBlocking,
    setIsBlocking,
    ownerData,
    setOwnerData,
    employeeData,
    setEmployeeData,
    venueData,
    setVenueData,
    venueImage,
    setVenueImage,
    courtData,
    setCourtData,
    courtImages,
    setCourtImages,
    accountData,
    setAccountData,
    editAccountId,
    setEditAccountId,
    editAccountForm,
    setEditAccountForm,
    editVenueId,
    setEditVenueId,
    editVenueForm,
    setEditVenueForm,
    editVenueImage,
    setEditVenueImage,
    editCourtId,
    setEditCourtId,
    editCourtForm,
    setEditCourtForm,
    editCourtExistingImages,
    setEditCourtExistingImages,
    editCourtImages,
    setEditCourtImages,
    loadVenues,
    loadOwners,
    loadEmployees,
    loadAccounts,
    loadBlocks,
    loadVenueRequests,
    handleCreateOwner,
    handleCreateEmployee,
    handleDeleteEmployee,
    handleCreateVenue,
    handleDeleteBlock,
    handleDeleteBlockSeries,
    handleCreateCourt,
    handleCreateAccount,
    handleToggleAccount,
    startEditAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    startEditVenue,
    saveEditVenue,
    startEditCourt,
    saveEditCourt,
    handleBlockSlots,
    handleUpdateVenueRequestStatus,
    handleDeleteVenueRequest,
  };
}

export type AdminSetupState = ReturnType<typeof useAdminSetup>;
