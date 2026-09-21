const nodemailer = require("nodemailer");
const path = require("path");
const { convert } = require("html-to-text");

// مسار الشعار - المفروض يكون موجود في backend/assets/logo.jpg
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.jpg");

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    this.from = `GoalSmash <${process.env.EMAIL_FROM}>`;
  }

  // 🛠️ يختار الإعدادات المناسبة تلقائيًا حسب البيئة اللي السيرفر شغال فيها
  createTransport() {
    // Production: Brevo
    if (process.env.NODE_ENV === "production") {
      return nodemailer.createTransport({
        host: process.env.BREVO_EMAIL_HOST,
        port: process.env.BREVO_EMAIL_PORT,
        secure: false,
        auth: {
          user: process.env.BREVO_EMAIL_USERNAME,
          pass: process.env.BREVO_EMAIL_PASSWORD,
        },
      });
    }

    // Development: Mailtrap
    return nodemailer.createTransport({
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
  }

  // 🎨 الهيكل العام لكل إيميل - هيدر فيه الشعار + محتوى + فوتر
  wrapTemplate(bodyContent) {
    return `
    <div style="background-color:#f4f6f5; padding:40px 16px; font-family:'Segoe UI', Tahoma, Arial, sans-serif;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background:#1f3d2b; padding:28px 20px; text-align:center;">
          <img src="cid:goalsmash-logo" alt="GoalSmash" style="width:64px; height:64px; border-radius:16px;" />
          <h1 style="color:#ffffff; font-size:20px; margin:12px 0 0; font-weight:800;">GoalSmash</h1>
        </div>

        <!-- Body -->
        <div style="padding:32px 28px; text-align:right; direction:rtl;">
          ${bodyContent}
        </div>

        <!-- Footer -->
        <div style="background:#f4f6f5; padding:18px 20px; text-align:center; border-top:1px solid #eee;">
          <p style="color:#999; font-size:12px; margin:0;">GoalSmash — احجز ملعبك في ثواني ⚽🎾</p>
        </div>

      </div>
    </div>`;
  }

  async send(subject, bodyContent) {
    const htmlContent = this.wrapTemplate(bodyContent);

    const emailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: htmlContent,
      text: convert(htmlContent),
      attachments: [
        {
          filename: "logo.jpg",
          path: LOGO_PATH,
          cid: "goalsmash-logo", // نفس الـ cid المستخدم في src="cid:..." فوق
        },
      ],
    };

    const transport = this.createTransport();
    await transport.sendMail(emailOptions);
  }

  async sendWelcome() {
    const body = `
      <h2 style="color:#1f3d2b; font-size:22px; margin:0 0 12px;">أهلاً بيك يا ${this.firstName} 👋</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 16px;">
        اتسجلت معانا في <strong>GoalSmash</strong>، وده يبقى أول خطوة على طريق إنك تحجز ملعبك المفضل بكل سهولة وبدون أي تعقيد.
      </p>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 24px;">
        هتلاقي عندنا أحسن ملاعب البادل والخماسي في المنطقة، وحجز في دقيقة واحدة بس.
      </p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${this.url}" style="background:#28a745; color:#fff; padding:13px 32px; text-decoration:none; border-radius:50px; font-weight:bold; font-size:15px; display:inline-block;">
          يلا نبدأ ⚽
        </a>
      </div>
      <p style="color:#999; font-size:13px; margin:0;">لو محتاج أي مساعدة، إحنا موجودين ليك في أي وقت.</p>
    `;
    await this.send("أهلاً بيك في GoalSmash ⚽🎾", body);
  }

  async sendPasswordResetOTP(otpCode) {
    const body = `
      <h2 style="color:#1f3d2b; font-size:20px; margin:0 0 12px;">استلمنا طلب تغيير الباسورد 🔐</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 20px;">
        محتاج تأكد إنك إنت اللي بتعمل كده؟ استخدم الكود ده عشان تكمل:
      </p>
      <div style="background:#f4f6f5; border:2px dashed #28a745; border-radius:14px; padding:18px; text-align:center; margin:0 0 20px;">
        <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#28a745;">${otpCode}</span>
      </div>
      <p style="color:#666; font-size:14px; margin:0 0 8px;">⏱ الكود ده هيفضل شغال لمدة <strong>10 دقايق</strong> بس.</p>
      <p style="color:#999; font-size:13px; margin:0;">لو إنت مش اللي طلبت كده، تجاهل الإيميل ده وهيفضل حسابك آمن زي ما هو.</p>
    `;
    await this.send("كود إعادة تعيين كلمة المرور 🔐", body);
  }

  async sendOTP(otpCode) {
    const body = `
      <h2 style="color:#1f3d2b; font-size:20px; margin:0 0 12px;">خطوة وحدة وخلصنا 🚀</h2>
      <p style="color:#555; font-size:15px; line-height:1.8; margin:0 0 20px;">
        استخدم الكود ده عشان تفعّل حسابك في GoalSmash:
      </p>
      <div style="background:#f4f6f5; border-radius:14px; padding:22px; text-align:center; margin:0 0 20px;">
        <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#28a745;">${otpCode}</span>
      </div>
      <p style="color:#666; font-size:14px; margin:0 0 8px;">⏱ الكود صالح لمدة <strong>10 دقايق</strong> بس، فسرّع شوية 😄</p>
      <p style="color:#999; font-size:13px; margin:0;">شكرًا إنك اخترت GoalSmash 🙏</p>
    `;
    await this.send("رمز تفعيل حسابك في GoalSmash", body);
  }
};
