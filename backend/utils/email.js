const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    // تعديل اسم المُرسل ليناسب تطبيق الملاعب
    this.from = `Venue Manager <${process.env.EMAIL_FROM}>`;
  }

  // 🛠️ Mailtrap (Development Only)
  createTransport() {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(subject, htmlContent) {
    const emailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: htmlContent,
      text: convert(htmlContent),
    };

    const transport = this.createTransport();
    await transport.sendMail(emailOptions);
  }

  async sendWelcome() {
    const html = `
      <div style="max-width: 600px; margin:auto; border-top: 8px solid #28a745; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdfdfd; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align: center;">
        <h1 style="color: #28a745; margin-bottom: 20px;">أهلاً بك في منصة الملاعب ⚽🎾</h1>
        <h2 style="color: #28a745;">Welcome to Venue Manager!</h2>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">مرحباً ${this.firstName}، نحن سعداء جداً بانضمامك إلينا.</p>
        <p style="font-size: 16px; color: #555;">الآن يمكنك استكشاف وحجز ملاعب البادل وكرة القدم بكل سهولة، أو إدارة ملاعبك باحترافية.</p>
        
        <div style="margin: 30px 0;">
          <a href="${this.url}" style="background: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">ابدأ رحلتك الآن | Start Now</a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999;">Venue Manager - أسهل طريقة لإدارة وحجز الملاعب</p>
      </div>
    `;
    await this.send("مرحباً بك في منصة حجز الملاعب | Welcome", html);
  }

  async sendPasswordResetOTP(otpCode) {
    const html = `
      <div style="font-family:Arial,sans-serif;text-align:center;padding:30px;">
        <h2 style="color:#28a745;">إعادة تعيين كلمة المرور</h2>
        <p>كود التحقق الخاص بك:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:10px;
                  color:#28a745;border:2px dashed #28a745;
                  padding:15px 30px;display:inline-block;border-radius:10px;
                  margin:20px 0;">
          ${otpCode}
        </div>
        <p style="color:#666;">صالح لمدة <strong>10 دقائق</strong> فقط</p>
        <p style="color:#999;font-size:0.85rem;">
          إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد.
        </p>
      </div>`;
    await this.send("إعادة تعيين كلمة المرور 🔐", html);
  }

  async sendOTP(otpCode) {
    const html = `
      <div style="max-width: 500px; margin: auto; padding: 40px; font-family: sans-serif; border: 1px solid #eee; text-align: center; border-radius: 15px; background: #fff;">
        <div style="font-size: 40px; margin-bottom: 20px;">🔐</div>
        <h2 style="color: #28a745; margin-bottom: 10px;">رمز التحقق</h2>
        <p style="color: #666;">استخدم الكود التالي لتفعيل حسابك في منصة الملاعب:</p>
        <div style="background: #f4f7f6; padding: 20px; border-radius: 10px; margin: 25px 0;">
          <h1 style="color: #28a745; letter-spacing: 10px; font-size: 36px; margin: 0;">${otpCode}</h1>
        </div>
        <p style="color: #999; font-size: 14px;">هذا الكود صالح لمدة 10 دقائق فقط.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">شكراً لثقتك بنا.</p>
      </div>
    `;
    await this.send("رمز التحقق الخاص بحسابك - Venue Manager", html);
  }
};
