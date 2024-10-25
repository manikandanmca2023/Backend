const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser =require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet'); // For security
const rateLimit = require('express-rate-limit'); // For rate limiting


// Initialize app
const app = express();
const PORT = process.env.PORT || 1503;

// Load environment variables
dotenv.config();

// MongoDB connection URL
const mongoUrl = process.env.MONGODB_URI || 'mongodb+srv://manimuthube1:manimuthube1@cluster0.x2jtj.mongodb.net/hallbooking'; // Example fallback

// Log the MongoDB URI for debugging
// console.log("MongoDB URI:", mongoUrl);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

// Connect to MongoDB
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

// User schema and model
    const userSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        dateOfBirth: { type: Date, required: true },
        phoneNumber: { type: String, required: true },
        profileImage: { type: String }, // URL to the image
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
    });
    const User = mongoose.model("User", userSchema);

// Admin schema and model
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model("Admin", adminSchema);

// Cashier Order schema and model
const cashierOrderSchema = new mongoose.Schema({
    orderNo: { type: Number, required: true },
    customerPhNo: { type: Number, required: true },
    productId: { type: Number, required: true },
    productName: { type: String, required: true },
    foodamount: { type: Number, required: true },
    productCategory: { type: String, required: true },
    date: { type: Date, required: true },
    paymentby: { type: Number, required: true },
    paymentfor: { type: Number, required: true },
});
const CashierOrder = mongoose.model("CashierOrder", cashierOrderSchema);

// Create a schema for orders
const orderSchema = new mongoose.Schema({
    items: [
      {
        id: String,
        name: String,
        price: Number,
        quantity: Number,
      },
    ],
    total: Number,
    createdAt: { type: Date, default: Date.now },
  });
  
const Order = mongoose.model('Order', orderSchema);

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    ingredients: { type: String, required: true },
    image: { type: String, required: true },
});

const Product = mongoose.model('Product', productSchema); 


// Event Schema
const eventSchema = new mongoose.Schema({
    date: String,
    time: String,
    eventName: String,
    department: String,
    coordinatorName: String,
    contact: String,
    email: String,
    mediaAvailable: Boolean,
    mediaStatus: {
        photo: Boolean,
        video: Boolean,
        reels: Boolean,
    }
});

const Event = mongoose.model('Event', eventSchema);
  
//_____________________________________________________________________________________________________________________________________________________

app.post('/products', async (req, res) => {
    const { name, price, ingredients, image } = req.body;
    try {
        const product = new Product({ name, price, ingredients, image });
        await product.save();
        res.status(201).json({ message: 'Product added successfully!', product });
    } catch (error) {
        res.status(400).json({ error: 'Error adding product.' });
        console.error(error);
    }
});

app.get('/data', async (req, res) => {
    try {
      const items = await Product.find(); 
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
})

app.get('/api/products', async (req, res) => {
    try {
      const products = await Product.find();
      res.json(products); se
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
  });
  app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

  app.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, ingredients, image } = req.body;

    try {
        const product = await Product.findByIdAndUpdate(id, {
            name,
            price,
            ingredients,
            image
        }, { new: true });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error(error); 
        res.status(500).json({ message: 'Server error' });
    }
});
  
 
  app.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ message: 'Product deleted' });
  });
  app.get('/data', async (req, res) => {
    try {
      const items = await Product.find(); 
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });



// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per window
    message: "Too many login attempts from this IP, please try again later."
});

// User registration endpoint
app.post('/register', upload.single('profileImage'), [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email address').custom(async (value) => {
        const user = await User.findOne({ email: value });
        if (user) {
            return Promise.reject('Email already in use');
        }
    }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('dateOfBirth').isISO8601().withMessage('Date of birth must be a valid date'),
    body('phoneNumber').isMobilePhone().withMessage('Invalid phone number'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, dateOfBirth, phoneNumber } = req.body;
    const profileImage = req.file ? req.file.path : null; // Get the image path if uploaded

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, dateOfBirth, phoneNumber, profileImage });
        await user.save();
        res.status(201).json({ message: "User registered successfully", user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// User login endpoint
app.post('/login', loginLimiter, [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.status(200).json({ message: "Successfully logged in", user: { name: user.name, email: user.email  , id:user._id} });
        } else {
            res.status(400).json({ error: "Invalid email or password" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// Admin registration endpoint
app.post('/admin/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = new Admin({ username, password: hashedPassword });
        await admin.save();
        res.status(201).json({ message: "Admin registered successfully", admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// Admin login endpoint
app.post('/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(400).json({ error: "Invalid username or password" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (isMatch) {
            res.status(200).json({ message: "Successfully logged in" });
        } else {
            res.status(400).json({ error: "Invalid username or password" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// Route to handle adding a new payment
app.post("/addpayment", async (req, res) => {
    const newOrder = new CashierOrder(req.body);
    try {
        await newOrder.save();
        res.status(201).send("Order added successfully");
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to add order");
    }
});

// Endpoint to get all orders
app.get("/orders", async (req, res) => {
    try {
        // Fetch all orders from the database
        const orders = await CashierOrder.find();

        // Check if orders exist
        if (orders.length === 0) {
            return res.status(404).send("No orders found");
        }

        // Send the orders back as a JSON response
        res.status(200).json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to retrieve orders");
    }
});

app.post('/getparticulardata', async (req, res) => {
    const { phoneNumber } = req.body;

    try {
        // Fetch orders from the database based on the phone number
        const orders = await CashierOrder.find({ customerPhNo: phoneNumber });

        // Check if orders exist
        if (orders.length === 0) {
            return res.status(404).send("No orders found for this phone number");
        }

        // Send the orders back as a JSON response
        res.status(200).json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to retrieve orders");
    }
});
  app.get('/user-details/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);

        // Check if the user was found
        if (!user) {
            return res.status(404).send({ success: false, error: true, message: 'User not found' });
        }

        res.status(200).send({ success: true, error: false, user });
    } catch (err) {
        console.log(err);
        res.status(500).send({ success: false, error: true, message: 'Server error' });
    }
});



//profel 
app.put('/user-details/:userId', async (req, res) => {
    try {
        const { name, email, phoneNumber } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { name, email, phoneNumber },
            { new: true } // Return the updated user
        );

        if (!user) {
            return res.status(404).send({ success: false, error: true, message: 'User not found' });
        }

        res.status(200).send({ success: true, error: false, user });
    } catch (err) {
        console.log(err);
        res.status(500).send({ success: false, error: true, message: 'Server error' });
    }
});




// Example Express.js route
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
  
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
  
    // Generate a reset token and send an email (not shown here)
    // Save the token to the user's document if needed
    // Send an email with the reset link (using a package like nodemailer)
    
    res.json({ message: 'Reset link sent to your email' });
  });



// Get user details
app.get('/user-details/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = users.find((u) => u.id === userId);
    
    if (user) {
        res.json({ user });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});



// Upload profile image
app.post('/upload-profile-image/:userId', upload.single('profileImage'), (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = users.find((u) => u.id === userId);
    
    if (user) {
        user.profileImage = req.file.path; // Save the file path to the user object
        res.json({ message: 'Profile image uploaded successfully', user });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const newEvent = new Event(req.body);
        await newEvent.save();
        res.status(201).json({ message: 'Event saved successfully!', event: newEvent });
    } catch (error) {
        console.error('Error saving event:', error);
        res.status(500).json({ message: 'Failed to save event' });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find(); // Fetch all events
        res.status(200).json(events); // Send back the events
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
});


// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
        },
    });
});


// Start the server
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
