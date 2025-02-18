import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        _id: { type: String, required: true },  // Fixed type definition
        name: { type: String, required: true },
        email: { type: String, required: true },
        imageUrl: { type: String, required: true },
        enrolledCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Course",
            }
        ],
    },
    { timestamps: true }  // Fixed option key
);

const User = mongoose.model("User", userSchema);

export default User;
