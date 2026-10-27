const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const Sentry = require("@sentry/node");

// الاسم بيتحط جوه HTML: من غير escape أي حد يسجل باسم فيه HTML يحقنه في الإيميل
const escapeHtml = (str = "") =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// مهلة للطلبات الخارجية: من غيرها مزود إيميل بطيء يعلّق طلب التسجيل/الـ OTP للأبد
const EMAIL_API_TIMEOUT_MS = 10000;

const LOGO_URL = `${process.env.SERVER_URL || "https://mla3balexandria-api.online"}/assets/logo.png`;

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    this.fromEmail = process.env.EMAIL_FROM;
    // اسم المرسل يظهر في الإشعارات
    this.fromName = "Tigi Hagz";
  }

  wrapTemplate(bodyContent) {
    return `
    <div style="background-color:#f4f6f5; padding:40px 16px; font-family:'Segoe UI', Tahoma, Arial, sans-serif;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        <div style="background:#1f3d2b; padding:28px 20px; text-align:center;">
          <img src="${LOGO_URL}" alt="Tigi Hagz" style="width:64px; height:64px; border-radius:16px; object-fit:cover;" />
          <h1 style="color:#ffffff; font-size:20px; margin:12px 0 0; font-weight:800;">Tigi Hagz - تيجي حجز</h1>
        </div>
        <div style="padding:32px 28px; text-align:right; direction:rtl;">
          ${bodyContent}
        </div>
        <div style="background:#f4f6f5; padding:18px 20px; text-align:center; border-top:1px solid #eee;">
          <p style="color:#999; font-size:12px; margin:0;">Tigi Hagz — احجز ملعبك في ثواني ⚽🎾</p>
        </div>
      </div>
    </div>`;
  }

  async sendViaBrevoAPI(subject, htmlContent, textContent) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: this.to, name: this.firstName }],
        subject,
        htmlContent,
        textContent,
      }),
      signal: AbortSignal.timeout(EMAIL_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Brevo API error (status ${response.status}): ${errorBody}`,
      );
    }
  }

  async sendViaResendAPI(subject, htmlContent, textContent) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [this.to],
        subject: subject,
        html: htmlContent,
        text: textContent,
      }),
      signal: AbortSignal.timeout(EMAIL_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Resend API error (status ${response.status}): ${errorBody}`,
      );
    }
  }

  async sendViaMailtrap(subject, htmlContent, textContent) {
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transport.sendMail({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: this.to,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  async send(subject, bodyContent) {
    const htmlContent = this.wrapTemplate(bodyContent);
    const textContent = convert(htmlContent);

    if (process.env.NODE_ENV === "production") {
      try {
        await this.sendViaBrevoAPI(subject, htmlContent, textContent);
      } catch (brevoError) {
        console.error(
          "Brevo failed, switching to backup (Resend)...",
          brevoError,
        );
        Sentry.captureException(
          new Error("Brevo Email Failed - Switched to Resend Backup"),
        );
        await this.sendViaResendAPI(subject, htmlContent, textContent);
      }
    } else {
      await this.sendViaMailtrap(subject, htmlContent, textContent);
    }
  }

  async sendWelcome() {
    const body = `
      <h2 style="color:#1f3d2b; font-size:22px; margin:0 0 12px;">أهلاً بيك يا ${escapeHtml(this.firstName)} 👋</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 16px;">
        نورتنا في <strong>Tigi Hagz</strong>، دي أول خطوة ليك عشان تحجز ملعبك المفضل وتلم الشلة في ثواني.
      </p>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 24px;">
        عندنا أحسن ملاعب البادل والخماسي، وحجز الماتش مش هياخد منك دقيقة.
      </p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${escapeHtml(this.url)}" style="background:#28a745; color:#fff; padding:13px 32px; text-decoration:none; border-radius:50px; font-weight:bold; font-size:15px; display:inline-block;">
          يلا نلعب ⚽
        </a>
      </div>
      <p style="color:#999; font-size:13px; margin:0;">لو محتاج أي مساعدة، إحنا معاك وفي ضهرك طول الوقت.</p>
    `;
    await this.send("نورتنا في Tigi Hagz ⚽", body);
  }

  async sendPasswordResetOTP(otpCode) {
    const body = `
      <h2 style="color:#1f3d2b; font-size:20px; margin:0 0 12px;">طلب تغيير الباسورد 🔐</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 20px;">
        لقينا طلب لتغيير الباسورد بتاعك. لو ده إنت، استخدم الكود ده عشان تكمل:
      </p>
      <div style="background:#f4f6f5; border:2px dashed #28a745; border-radius:14px; padding:18px; text-align:center; margin:0 0 20px;">
        <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#28a745;">${otpCode}</span>
      </div>
      <p style="color:#666; font-size:14px; margin:0 0 8px;">⏱ الكود ده شغال لمدة <strong>10 دقايق</strong> بس.</p>
      <p style="color:#999; font-size:13px; margin:0;">لو مش إنت اللي طلبت كده، كبّر دماغك وحسابك في أمان.</p>
    `;
    await this.send("كود إعادة تعيين الباسورد 🔐", body);
  }

  async sendOTP(otpCode) {
    const body = `
      <h2 style="color:#1f3d2b; font-size:20px; margin:0 0 12px;">خطوة واحدة وخلصنا 🚀</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 20px;">
        خد الكود ده عشان تفعّل حسابك في Tigi Hagz:
      </p>
      <div style="background:#f4f6f5; border-radius:14px; padding:22px; text-align:center; margin:0 0 20px;">
        <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#28a745;">${otpCode}</span>
      </div>
      <p style="color:#666; font-size:14px; margin:0 0 8px;">⏱ الكود شغال لمدة <strong>10 دقايق</strong> بس، فسرّع إيدك شوية 😄</p>
    `;
    await this.send("كود تفعيل حسابك في Tigi Hagz", body);
  }

  async sendBookingTicket(bookingData) {
    const bDate = new Date(bookingData.startTime).toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const bTime = new Date(bookingData.startTime).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // إنشاء رابط للصورة الخاصة بالـ QR Code (باستخدام API مجاني بيطلع صورة QR)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${bookingData._id}`;

    const remaining = Math.max(
      bookingData.totalPrice - (bookingData.deposit || 0),
      0,
    );
    const paymentStatusText =
      remaining > 0
        ? `<span style="color:#d9534f; font-weight:bold;">باقي: ${remaining} ج.م (تدفعهم في الملعب)</span>`
        : `<span style="color:#28a745; font-weight:bold;">خالص بالكامل</span>`;

    const body = `
      <h2 style="color:#1f3d2b; font-size:20px; margin:0 0 12px; text-align:center;">حجزك اتأكد يا بطل! 🎉</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 20px; text-align:center;">
        أهلاً يا ${escapeHtml(this.firstName)}، حجزك في <strong>${escapeHtml(bookingData.venue.name)}</strong> اتأكد معانا.. جهّز فريقك!
      </p>
      
      <!-- تذكرة الحجز -->
      <div style="background:#fff; border:1px solid #ddd; border-radius:16px; padding:20px; margin:0 auto 20px; max-width:350px; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        <img src="${qrCodeUrl}" alt="QR Code" style="width:150px; height:150px; margin-bottom:15px; border:4px solid #f4f6f5; border-radius:12px;" />
        <p style="color:#888; font-size:12px; margin-bottom:15px;">رقم الحجز: ${bookingData._id}</p>
        
        <div style="background:#f9f9f9; border-radius:12px; padding:15px; text-align:right;">
          <p style="margin:0 0 8px; font-size:14px; border-bottom:1px solid #eee; padding-bottom:8px;">
            <strong style="color:#333;">الملعب:</strong> ${escapeHtml(bookingData.court.name)}
          </p>
          <p style="margin:0 0 8px; font-size:14px; border-bottom:1px solid #eee; padding-bottom:8px;">
            <strong style="color:#333;">الميعاد:</strong> ${bDate}، الساعة ${bTime}
          </p>
          <p style="margin:0 0 8px; font-size:14px; border-bottom:1px solid #eee; padding-bottom:8px;">
            <strong style="color:#333;">حساب الماتش:</strong> ${bookingData.totalPrice} ج.م
          </p>
          <p style="margin:0; font-size:14px;">
            ${paymentStatusText}
          </p>
        </div>
      </div>
      
      <p style="color:#999; font-size:13px; margin:0; text-align:center;">لما توصل الملعب إن شاء الله، افتح الإيميل ده وورّي الكود (QR) للكابتن عشان يأكد وصولك.</p>
    `;
    await this.send("تذكرة حجزك في Tigi Hagz 🎟️", body);
  }
};
