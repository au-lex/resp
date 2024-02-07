const express = require('express');
const cors = require('cors'); 
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
   app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: ['http://localhost:5173', 'https://joombow-web-application.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://aulex500:500pauli@cluster0.n9nnpwv.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// Load the secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-generated-secret';
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  otp: String,
  verified: { type: Boolean, default: false },
  referralCode: String,
  referralLink: String,
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aulex500@gmail.com',
    pass: 'xwrdzhyqseygbcod'
  },

    port: 465,
  host: "smtp.gmail.com",
  secure: true,
});
// Function to generate a unique referral code
function generateReferralCode() {
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return randomString;
}
app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, referralCode } = req.body;
  // Check if the referralCode is valid
  let referredByUser = null;
  if (referralCode) {
    referredByUser = await User.findOne({ referralCode });
    if (!referredByUser) {
      return res.status(400).send({ message: 'Invalid referral code' });
    }
  }
  // Generate a unique referral code for the new user
  const newReferralCode = generateReferralCode();
  // Generate referral link
  const referralLink = `https://your-website.com/signup?ref=${newReferralCode}`;
  // Save the new user with referral link
  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP

  // const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  const newUser = new User({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    otp,
    referralCode: newReferralCode,
    referralLink,
    referredBy: referredByUser ? referredByUser._id : null
  });
  try {
    await newUser.save();
    // Send OTP to user's email using Nodemailer
    const mailOptions = {
      from: 'aulex500@gmail.com',
      to: email,
      subject: 'OTP for Registration',
      text: `Your OTP for registration is: ${otp}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error.message);
      }
      console.log('Email sent: ' + info.response);
    });
    // Update the referredBy field of the newly signed up user
    if (referredByUser) {
      referredByUser.referralCount += 1;
      referredByUser.balance += 400;
      await referredByUser.save();
    }
    const token = jwt.sign({ email: newUser.email }, JWT_SECRET, { expiresIn: '1h' });
    res.send({ message: 'OTP sent successfully!', token });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.post('/verify', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email, otp });
    if (!user) {
      return res.status(400).send({ message: 'Invalid OTP' });
    }
    user.verified = true;
    await user.save();
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.send({ message: 'OTP verified successfully!', token });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({ message: 'Invalid credentials' });
    }
    // Check if the user is verified
    if (!user.verified) {
      return res.status(401).send({ message: 'User not verified. Please verify your email first.' });
    }
    // Verify password using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
      return res.send({ message: 'Login successful!', token });
    } else {
      return res.status(401).send({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.post('/logout', (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized: No token provided' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized: Invalid token' });
    }
    // Implement your logout logic here (e.g., clear user session)
    res.send({ message: 'Logout successful!' });
  });
});
app.put('/edit-user/:id', async (req, res) => {
  const userId = req.params.id;
  const { firstName, lastName, email, password } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    // Update user data
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    await user.save();
    res.send({ message: 'User updated successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});




app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

   
    if (!user) {
      console.log(`User with email ${email} not found`);
      return res.status(404).send({ message: 'User not found' });
    }


    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    user.otp = otp;
    await user.save();

    // Send OTP to user's email using Nodemailer
    const mailOptions = {
      from: 'aulex500@gmail.com',
      to: email,
      subject: 'OTP for Password Reset',
      text: `Your OTP for password reset is: ${otp}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).send({ message: 'Error sending OTP for password reset' });
      }
      console.log('Email sent: ' + info.response);
      res.send({ message: 'OTP for password reset sent successfully!' });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});


app.post('/save-user', async (req, res) => {
  const {name, email} = req.body;
    console.log(req.body)
  try {
    const userExist = await User.findOne({email:email})
    if (userExist) {
      console.log('user already exist')
      return  res.status(200).json({ success: true });
      

    }
    // Save the user details to MongoDB
    const userPassword ='123456'
    const newUser = new User({
      firstName: name,
  lastName: name,
  password: userPassword,
  email,
  verified:true
  
    });
    await newUser.save();
    console.log('user created')
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving user:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
       
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email, otp });

    if (!user) {
      return res.status(400).send({ message: 'Invalid OTP' });
    }

    // Update user password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.send({ message: 'Password reset successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});





app.delete('/delete-user/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send({ message: 'Account deleted successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
