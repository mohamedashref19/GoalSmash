# Venue Manager Pro

Transform the existing sports venue dashboard into a fully functional, responsive React prototype.

IMPORTANT:

- Keep the existing overall visual style and dashboard design.

- Use React state for navigation between views.

- The entire interface must use RTL layout and Arabic text.

- The design must be professional, modern, clean, and suitable for a sports venue management system.

====================================================

1. RESPONSIVE MOBILE BEHAVIOR

====================================================

Make the entire dashboard strictly mobile responsive.

Desktop:

- Keep the right sidebar visible.

- Main content should adapt properly beside the sidebar.

Mobile:

- Hide the right sidebar completely by default.

- Add a hamburger menu icon in the top header.

- Clicking the hamburger icon should open the sidebar as a mobile drawer/overlay.

- Clicking a navigation link should automatically close the mobile menu.

- Add a backdrop behind the mobile sidebar.

- The layout must not have horizontal scrolling.

For the "المباريات القادمة" section:

- On desktop, keep the existing table layout.

- On mobile only, completely transform the table into vertically stacked cards.

- Each match card should display all match information clearly:

  - اسم العميل أو الفريق

  - نوع الرياضة

  - اسم الملعب

  - التاريخ

  - الوقت

  - حالة الحجز

  - السعر أو المبلغ

- Cards should be easy to scan and must not cause horizontal scrolling.

====================================================

2. MULTI-VIEW NAVIGATION

====================================================

Make the sidebar navigation links functional using React state.

Create these main views:

1. نظرة عامة

2. الجدول

3. الإعدادات

Use a React state such as:

const [activeView, setActiveView] = useState("overview");

When clicking a sidebar navigation item:

- Update activeView.

- Highlight the active navigation item.

- Replace the main content area with the selected view.

- Do not reload the page.

Example navigation mapping:

"نظرة عامة" -> overview

"الجدول" -> schedule

"الإعدادات" -> settings

The sidebar navigation should work on both desktop and mobile.

====================================================

3. VIEW: نظرة عامة

====================================================

This should remain the main dashboard overview.

Keep or improve the existing dashboard content, including:

- Summary statistics cards.

- Upcoming matches section: "المباريات القادمة".

- Any existing revenue or booking statistics.

Add a clean analytics section:

Top area:

- Bar chart titled: "الإيرادات الأسبوعية"

- Pie chart titled: "مقارنة إيرادات البادل والخماسي"

Bottom area:

Create a table titled: "أفضل العملاء"

Columns:

- صورة اللاعب

- الاسم

- إجمالي الحجوزات

- إجراء

Each row should include a button:

"إرسال كود خصم"

The analytics section should be data-rich but clean and easy to read.

On mobile:

- Charts should stack vertically.

- The customers table should become responsive and avoid horizontal scrolling.

====================================================

4. VIEW: الجدول

====================================================

Create an interactive daily schedule calendar for managing sports courts.

Use RTL layout and Arabic text.

Structure:

- Horizontal axis = Hours of the day.

- Vertical axis = Court names.

Example courts:

- بادل 1

- بادل 2

- ملعب خماسي A

- ملعب خماسي B

Example hours:

10:00

11:00

12:00

13:00

14:00

15:00

16:00

17:00

18:00

19:00

20:00

21:00

22:00

Display booking blocks across the schedule.

Booking colors:

- Green = "حجز التطبيق"

- Blue = "حجز يدوي"

- Gray = "صيانة"

Each booking block should:

- Span across its booked time duration.

- Display booking information.

- Be visually distinct.

For empty time slots:

- Add a hover state on desktop.

- Show a small button:

  "حجز سريع"

Clicking "حجز سريع" should open a modal.

On mobile:

- Make the schedule usable without breaking the layout.

- Allow the time grid to adapt or scroll inside the schedule area only if necessary.

- Do not create page-level horizontal scrolling.

====================================================

5. QUICK BOOKING MODAL

====================================================

Create a sleek modal popup.

RTL layout.

Arabic text.

Title:

"حجز يدوي سريع"

Form fields:

1. اسم العميل

- Text input

2. رقم الهاتف

- Text input

3. نوع الرياضة

- Dropdown options:

  - خماسي

  - بادل

4. العربون المدفوع

- Number input

- Currency: EGP

5. المبلغ المتبقي

- Read-only field

- Automatically calculated from the selected booking price minus the deposit.

Bottom actions:

- Secondary button:

  "إلغاء"

- Primary button:

  "تأكيد الحجز"

Behavior:

- Cancel closes the modal.

- Confirm booking closes the modal and optionally adds the booking to the schedule state.

- Clicking outside the modal should close it.

- Add a subtle overlay behind the modal.

The modal should be minimalist, professional, and mobile responsive.

====================================================

6. VIEW: الإعدادات

====================================================

Create a complete sports venue settings page.

Section 1:

Title:

"إدارة الملاعب"

Display a list of current courts.

Example:

- بادل 1

- بادل 2

- ملعب خماسي A

- ملعب خماسي B

Include a primary button:

"+ إضافة ملعب جديد"

Each court can have simple edit/delete placeholder actions.

--------------------------------

Section 2:

Title:

"التسعير الذكي"

Allow setting different prices based on time.

Include two pricing categories:

- أوقات الذروة

- الأوقات العادية

Use:

- Time range controls or sliders.

- Price input fields in EGP.

Example:

أوقات الذروة:

18:00 - 23:00

السعر: 500 جنيه

الأوقات العادية:

10:00 - 18:00

السعر: 300 جنيه

The layout should clearly explain which time periods belong to each price.

--------------------------------

Section 3:

Title:

"إضافات الحجز"

Add functional-looking toggle switches for:

- تأجير مضارب

- تأجير كور

- قمصان الفريق

Each toggle should be controlled using React state.

====================================================

7. COMPONENT STRUCTURE

====================================================

Organize the React prototype into reusable components.

Suggested structure:

App

├── Sidebar

├── MobileSidebar

├── Header

├── OverviewView

│   ├── StatsCards

│   ├── UpcomingMatches

│   ├── RevenueChart

│   ├── SportsRevenueChart

│   └── TopCustomers

│

├── ScheduleView

│   ├── ScheduleGrid

│   └── QuickBookingModal

│

└── SettingsView

    ├── CourtsManagement

    ├── SmartPricing

    └── BookingExtras

====================================================

8. STATE MANAGEMENT

====================================================

Use React useState for the prototype.

Suggested states:

const [activeView, setActiveView] = useState("overview");

const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

Also create state for:

- Toggle switches.

- Current selected court.

- Booking form data.

- Example bookings if needed.

Do not use backend APIs.

Use realistic dummy data.

====================================================

9. DESIGN REQUIREMENTS

====================================================

- RTL direction everywhere.

- Arabic typography.

- Clean dashboard spacing.

- Consistent cards.

- Modern buttons.

- Clear active navigation states.

- Soft shadows and subtle borders.

- Responsive grid system.

- No horizontal scrolling on the entire page.

- Smooth transitions for sidebar, modal, hover states, and view switching.

Mobile breakpoints:

- Desktop: sidebar permanently visible.

- Tablet: responsive compressed layout.

- Mobile: sidebar becomes hamburger drawer.

The final result should feel like a polished SaaS dashboard for managing padel and football courts, with functional navigation and interactive UI behavior rather than just static mockups.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://malaeibaskandirih.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/603940cd-4627-43ee-8f5f-7a6914e870e7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
