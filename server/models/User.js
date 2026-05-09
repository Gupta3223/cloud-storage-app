import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    storageUsed: {
      type: Number,
      default: 0
    },
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    fileCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
