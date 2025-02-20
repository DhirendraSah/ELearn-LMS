import User from "../models/User.js"
import { Purchase } from "../models/Purchase.js";
import Stripe from "stripe";
import Course from "../models/Course.js";

export const getUserData = async(req, res)=> {
    try{
        const userId = req.auth.userId
        const user = await User.findById(userId)

        if(!user){
            return res.json({sucess: false, message: 'User not found'})
        }

        res.json({sucess: true, user})
    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

//User enrolled courses with lecture links
export const userEnrolledCourses = async(req, res)=> {
    try{
        const userId = req.auth.userId
        const userData = await User.findById(userId).populate('enrolledCourses')
        res.json({sucess: true, enrolledCourses: userData.enrolledCourses})
    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

//Purchase Course
export const purchaseCourse = async(req, res) => {
    try{
      const {courseId} = req.body
      const {origin} = req.headers
      const userId = req.auth.userId
      const userData = await User.findById(userId)
      const courseData = await Course.findById(courseId)
  
      if(!userData || !courseData){
        return res.json({ success: false, message: 'data not found' })
      }
      const purchaseData = {
        courseId: courseData._id,
        userId,
        amount: (courseData.coursePrice - courseData.discount * courseData.coursePrice /100).toFixed(2),
      }
  
      const newPurchase = await Purchase.create(purchaseData)
  
      //stripe gateway initialize
      const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)

      const currency = process.env.CURRENCY.toLowerCase()

      //creating line items to for stripe
      const line_items = [{
        price_data: {
            currency,
            product_data: {
                name: courseData.courseTitle
            },
            unit_amount: Math.floor(newPurchase.amount ) * 100
        },
        quantity: 1
      }]

      const session = await stripeInstance.checkout.sessions.create({
        success_url: `${origin}/loading/my-enrollments`,
        cancel_url: `${origin}/`,
        line_items: line_items,
        mode: 'payment',
        metadata: {
            purchseId: newPurchase._id.toString()
        }
      })
      res.json({success: true, session_url: session.url})
    }catch (error) {
      res.json({ success: false, message: error.message });
    }
  }