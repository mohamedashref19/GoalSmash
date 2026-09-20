// Migration Script: fix old court image URLs
// تشغيل مرة واحدة بس عشان تصلح الصور القديمة المسجلة بصيغة http://192.168.1.4:3000/...
// وتحولها لـ relative path زي الصيغة الجديدة

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Venue = require("./models/venueModel");
const Court = require("./models/courtModel");

dotenv.config({ path: "./.env" });

const DB = process.env.DATABASE;

const fixCourtImages = async () => {
  try {
    await mongoose.connect(DB);
    console.log("DB connection successful!");

    // هات كل الملاعب اللي صورتها لسه بالصيغة القديمة (فيها http)
    const courts = await Court.find({
      image: { $regex: "^http://" },
    });

    console.log(`Found ${courts.length} court(s) with old-style image URLs.`);

    if (courts.length === 0) {
      console.log("No courts need fixing. Exiting.");
      process.exit(0);
    }

    let fixedCount = 0;

    for (const court of courts) {
      const oldImage = court.image;

      // نستخرج بس الجزء اللي بعد /uploads/venues/
      const match = oldImage.match(/\/uploads\/venues\/.+$/);

      if (match) {
        const newImage = match[0]; // مثال: /uploads/venues/venue-xxx.jpeg

        await Court.findByIdAndUpdate(court._id, {
          image: newImage,
        });

        console.log(`Fixed court "${court.name}": ${oldImage} -> ${newImage}`);
        fixedCount++;
      } else {
        console.log(
          `Could not parse image path for court "${court.name}": ${oldImage}`,
        );
      }
    }

    console.log(
      `\nDone. Fixed ${fixedCount} out of ${courts.length} court(s).`,
    );
    process.exit(0);
  } catch (error) {
    console.error("Error while fixing court images:", error);
    process.exit(1);
  }
};

fixCourtImages();
