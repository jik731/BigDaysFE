// src/api/endpoints.ts
// NOTE: VITE_API_BASE already includes /api/v1 — do NOT add /v1 here.

export const AuthEndpoints = {
  login: "/User/Login",
  logout: "/User/Logout",
  refreshToken: "/User/RefreshToken",
  me: "/auth/me",
  register: "/User/Create",
  verifyEmail: "/User/VerifyEmail",
  forgotPassword: "/User/ForgotPassword",
  resetPassword: "/User/ResetForgotPassword",
};

export const EventsEndpoints = {
  all: "/event/GetEventsList",
  allByUser: "/event/GetEventsListByUser",
  byId: (id: string) => `/event/${id}`,
  create: "/event/Create",
  update: `/event/Update`,
  updateTableQuantity: `/event/UpdateTableQuantity`, // TODO: not in backend docs — verify with backend team
  activateEvent: (id: string) => `/event/Activate/${id}`,
  deactivateEvent: (id: string) => `/event/Deactivate/${id}`,
  previewEvent: `/event/Preview`, // TODO: no backend endpoint yet
  delete: (id: string) => `/events/${id}`, // TODO: no backend endpoint — use Deactivate instead
  importRsvps: (eventId: string) => `/events/${eventId}/rsvps/import`, // TODO: no backend endpoint yet
  exportRsvps: (eventId: string) => `/events/${eventId}/rsvps/export`, // TODO: no backend endpoint yet
  eventRsvpInternal: (eventGuid: string) => `/event/eventRsvpInternal/${eventGuid}`,
  updateSlug: `/event/UpdateSlug`,
};

export const RsvpsEndpoints = {
  all: (eventId: string) => `/rsvp/GetRsvp/List/${eventId}`,
  forEvent: (eventId: string) => `/rsvp/GetRsvp/List/${eventId}`,
  byId: (eventId: string, id: string) => `/events/${eventId}/rsvps/${id}`,
  create: () => `/rsvp/Create`,
  update: () => `/rsvp/Update`,
  delete: () => `/rsvp/Delete`,
};

export const TablesEndpoints = {
  all: (id: string) => `/TableArrangement/Summary/${id}`,
  byId: (id: string) => `/TableArrangement/Summary/${id}`,
  create: "/TableArrangement/Create",
  bulkCreate: "/TableArrangement/BulkCreate",
  update: "/TableArrangement/Update",
  delete: (tableId: string) => `/TableArrangement/Delete/${tableId}`,
  bulkDelete: "/TableArrangement/BulkDelete",
  updateLayout: (id: string) => `/tables/${id}/layout`, // TODO: no backend endpoint (DragDropUpdate returns 500)
  tableGuests: (tableId: string) => `/Guest/ByTable/${tableId}`, // Fixed: was wrong path
  reassignGuest: (tableId: string, guestId: string) =>
    `/tables/${tableId}/guests/${guestId}/reassign`, // TODO: no backend endpoint — use Guest AssignTable + UnassignTable
};

export const GuestEndpoints = {
  all: (id: string) => `/Guest/ByEvent/${id}`,
  byTable: (tableId: string) => `/Guest/ByTable/${tableId}`,
  create: "/Guest/Create",
  update: "/Guest/Update",
  assignTable: (guestId: string, tableId: string) => `/Guest/${guestId}/AssignTable/${tableId}`,
  unassignTable: (guestId: string) => `/Guest/${guestId}/UnassignTable`,
  autoAssign: (eventGuid: string) => `/Guest/AutoAssign/${eventGuid}`,
  gift: (guestId: string) => `/Guest/${guestId}/Gift`,
};

// TODO: No backend Seating API exists — these are stubs. Seating feature pages will 404.
export const SeatingEndpoints = {
  all: "/seating",
  byId: (id: string) => `/seating/${id}`,
  create: "/seating",
  update: (id: string) => `/seating/${id}`,
  delete: (id: string) => `/seating/${id}`,
};

export const UsersEndpoints = {
  all: "/User/GetUsersList",
  byGuid: (guid: string) => `/User/guid/${guid}`,
  create: "/User/Create",
  update: "/User/Update",
  activate: (id: number) => `/User/Activate/${id}`,
  deactivate: (id: number) => `/User/Deactivate/${id}`,
  updatePassword: "/User/UpdatePassword",
  updateRole: (id: number) => `/User/UpdateRole?id=${id}`,
};

export const WalletEndpoints = {
  getByEvent: (eventGuid: string) => `/Wallet/GetWalletByEvent/${eventGuid}`,
  getByGuid: (walletGuid: string, eventGuid: string) => `/Wallet/${walletGuid}?eventGuid=${eventGuid}`,
  create: "/Wallet/Create",
  update: "/Wallet/Update",
  delete: "/Wallet/Delete",
  activate: (id: string) => `/Wallet/Activate/${id}`,
  deactivate: (id: string) => `/Wallet/Deactivate/${id}`,
};

export const TransactionEndpoints = {
  getByWallet: (walletGuid: string, eventGuid: string) =>
    `/Transaction/${walletGuid}/transactions?eventGuid=${eventGuid}`,
  getById: (transactionId: string, eventGuid: string) =>
    `/Transaction/${transactionId}?eventGuid=${eventGuid}`,
  create: "/Transaction/Create",
  update: "/Transaction/Update",
  delete: "/Transaction/Delete",
};

export const FormFieldsEndpoints = {
  all: (eventId: string) => `/question/GetQuestions/${eventId}`,
  create: () => `/question/Create`,
  update: () => `/question/Update`,
  activate: () => `/question/Activate`,
  deactivate: () => `/question/Deactivate`,
  delete: () => `/question/Delete`,
};

export const AnswerEndpoints = {
  byRsvp: (rsvpGuid: string) => `/answer/GetAnswersByRsvp/${rsvpGuid}`,
  update: () => `/answer/Update`,
};

export const PublicRsvpEndpoints = {
  submit: () => `/rsvp/Create`,
  designByToken: (token: string) => `/RsvpDesign/share/${token}`,
};

export const PublicEventEndpoints = {
  bySlug: (slug: string) => `/event/eventRsvp/slug/${slug}`,
};

export const RsvpDesignEndpoints = {
  get: (eventGuid: string) => `/RsvpDesign/${eventGuid}/design`,
  /** POST — creates a new version (auto-incremented) */
  save: (eventGuid: string) => `/RsvpDesign/${eventGuid}/design`,
  /** PUT — updates an existing version in place */
  update: (eventGuid: string, version: number) => `/RsvpDesign/${eventGuid}/design/${version}`,
  publish: (eventGuid: string, version: number) => `/RsvpDesign/${eventGuid}/design/${version}/publish`,
  shareToken: (eventGuid: string, version: number) => `/RsvpDesign/${eventGuid}/design/${version}/share-token`,
};

export const DashboardEndpoints = {
  summary: (eventGuid: string) => `/Dashboard/Summary/${eventGuid}`,
};

export const FloorPlanEndpoints = {
  get: (eventGuid: string) => `/FloorPlan/${eventGuid}`,
  save: (eventGuid: string) => `/FloorPlan/${eventGuid}`,
};

export const QrEndpoints = {
  generateAll: (eventId: string) => `/qr/generate-all/${eventId}`,
  listByEvent: (eventId: string) => `/qr/list/${eventId}`,
  revoke: (token: string) => `/qr/revoke/${token}`,
};

export const MediaEndpoints = {
  upload: "/Media/Upload",
  // TODO: implement DELETE /api/media/{fileName} on BE to remove CDN files when replaced
  delete: (fileName: string) => `/Media/${fileName}`,
};

export const CheckInEndpoints = {
  scan: `/checkin/scan`,
  undo: `/checkin/undo`,
};

export const PublicQrEndpoints = {
  lookup: (eventId: string) => `/qr/lookup/${eventId}`,
};

export const CrewEndpoints = {
  byEvent: (eventGuid: string) => `/Crew/ByEvent/${eventGuid}`,
  create: "/Crew/Create",
  update: "/Crew/Update",
  delete: (crewGuid: string) => `/Crew/Delete/${crewGuid}`,
  login: "/Crew/Login",
};

export const ChecklistEndpoints = {
  byEvent: (eventGuid: string) => `/Checklist/ByEvent/${eventGuid}`,
  create: "/Checklist/Create",
  update: "/Checklist/Update",
  delete: (id: string) => `/Checklist/${id}`,
  seed: (eventGuid: string) => `/Checklist/Seed/${eventGuid}`,
};
