import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";

// Clerk Webhook Controller
export const clerkwebhooks = async (req, res) => {
    try {
        const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

        await whook.verify(JSON.stringify(req.body), {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"],
        });

        const { data, type } = req.body;

        switch (type) {
            case "user.created": {
                const userData = {
                    _id: data.id,
                    email: data.email_addresses[0].email_address,
                    name: data.first_name + " " + data.last_name,
                    imageUrl: data.image_url,
                };
                await User.create(userData);
                break;
            }

            case "user.updated": {
                const userData = {
                    email: data.email_addresses[0].email_address,
                    name: data.first_name + " " + data.last_name,
                    imageUrl: data.image_url,
                };
                await User.findByIdAndUpdate(data.id, userData);
                break;
            }

            case "user.deleted": {
                await User.findByIdAndDelete(data.id);
                break;
            }

            default:
                console.log(`Unhandled Clerk event: ${type}`);
                break;
        }

        res.json({ success: true });
    } catch (e) {
        console.error("❌ Clerk Webhook Error:", e.message);
        res.status(400).json({ success: false, message: e.message });
    }
};

// Stripe Webhook Controller
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhooks = async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
        event = stripeInstance.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("❌ Stripe Webhook Signature Verification Failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`✅ Stripe Webhook Received: ${event.type}`);

    switch (event.type) {
        case "checkout.session.completed": {
            try {
                const session = event.data.object;
                const purchaseId = session.metadata?.purchaseId;

                if (!purchaseId) {
                    console.error("❌ No purchaseId found in session metadata!");
                    return res.status(400).json({ success: false, message: "No purchaseId found" });
                }

                const purchaseData = await Purchase.findById(purchaseId);
                if (!purchaseData) {
                    console.error(`❌ Purchase ID ${purchaseId} not found in database!`);
                    return res.status(400).json({ success: false, message: "Purchase not found" });
                }

                const userData = await User.findById(purchaseData.userId);
                const courseData = await Course.findById(purchaseData.courseId.toString());

                if (!userData || !courseData) {
                    console.error("❌ User or Course not found!");
                    return res.status(400).json({ success: false, message: "User or Course not found" });
                }

                // ✅ Update MongoDB
                courseData.enrolledStudents.push(userData._id);
                await courseData.save();

                userData.enrolledCourses.push(courseData._id);
                await userData.save();

                purchaseData.status = "completed";
                await purchaseData.save();

                console.log("✅ Payment successful! Purchase updated in MongoDB.");
                res.json({ success: true });
            } catch (error) {
                console.error("❌ Error processing payment:", error.message);
                res.status(500).json({ success: false, message: error.message });
            }
            break;
        }

        case "payment_intent.payment_failed": {
            try {
                const paymentIntent = event.data.object;
                const session = await stripeInstance.checkout.sessions.retrieve(paymentIntent.metadata.checkout_session_id);
                const { purchaseId } = session.metadata;

                const purchaseData = await Purchase.findById(purchaseId);
                if (purchaseData) {
                    purchaseData.status = "failed";
                    await purchaseData.save();
                    console.log("❌ Payment failed! Purchase status updated.");
                }
                res.json({ success: true });
            } catch (error) {
                console.error("❌ Error handling payment failure:", error.message);
                res.status(500).json({ success: false, message: error.message });
            }
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
            res.json({ received: true });
    }
};
