require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const userRoutes = require('./routes/user');
const linkedinRoutes = require('./routes/linkedin');
require('./db'); // MongoDB connection

const app = express();
app.use(cors());
// simple request logging to see incoming requests in the terminal
app.use(morgan('dev'));
app.use(bodyParser.json());

// Routes
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/user', userRoutes);
app.use('/linkedin', linkedinRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
