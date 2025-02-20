import {clerkClient} from  '@clerk/express'
import Course from '../models/Course.js'
import {v2 as cloudinary} from 'cloudinary'
import { Purchase } from '../models/Purchase.js'

//update role to educator
export const updateRoleToEducator = async (req, res)=> {
    try{
        const userId = req.auth.userId
        await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: 'educator',
            }
        })
        res.json({sucess: true, message: 'you can publish a course now'})

    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

//Add new  educator courses
export const addCourse = async (req, res)=> {
    try{
       const {courseData} = req.body
       const imageFile = req.file
       const educatorId = req.auth.userId 

       if(!imageFile){
        return res.json({sucess: false, message: 'Please upload a course image'})
       }

       const parsedCourseData = await JSON.parse(courseData)
       parsedCourseData.educator = educatorId
       const newCourse = await Course.create(parsedCourseData)
       const imageUpload = await cloudinary.uploader.upload(imageFile.path)
       newCourse.courseThumbnail = imageUpload.secure_url
       await newCourse.save()
       res.json({sucess: true, message: 'Course added successfully'})

    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

//Get educator courses
export const getEducatorCourses = async (req, res)=> {
    try{
       const educator = req.auth.userId 
       const courses = await Course.find({educator})
       res.json({sucess: true, courses})
    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

// Get Educator Dashboard Data
export const educatorDashboardData = async()=> {
    try{
        const educator = req.auth.userId;
        const courses = await Course.find({educator})
        const totalCourses = courses.length;

        const courseIds = courses.map(course => course._id);

        //calculate total earnings
        const purchases = await Purchase.find({
            courseId: { $in: courseIds },
            status: 'completed'
        });

        const totalEarnings = purchases.reduce((sum, purchase) =>  sum + purchase.amount,0);

        //collect unique enrolled student IDS with their courses
        const enrolledStudentData = [];
        for(const course of courses){
            const students = await User.find({
                _id: {$in: course.enrolledStudents}
            }, 'name imageUrl');

            students.forEach(student => {
                enrolledStudentData.push({
                    courseTitle: course.courseTitle,
                    student
                });
            });
        }
        res.json({sucess: true, dashboardData: {
            totalEarnings,  enrolledStudentData, totalCourses 
        }})
    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}

// Get enrolled Student data with purchase data
export const  getEnrolledStudentData = async(req, res)=> {
    try{
        const educator = req.auth.userId;
        const courses = await Course.find({educator});
        const courseIds = courses.map(course => course._id);

        const purchases = await Purchase.find({
           courseId: {$in: courseIds},
           status: 'completed'
        }).populate('userId', 'name imageUrl').populate('courseId', 'courseTitle')

        const enrolledStudents = purchases.map(purchase => ({
            student: purchase.userId,
            courseTitle: purchase.courseId.courseTitle,
            purchaseDate: purchase.createdAt
        }));
        res.json({sucess: true, enrolledStudents})
    }catch(e){
        res.json({sucess: false, message: error.message})
    }
}
