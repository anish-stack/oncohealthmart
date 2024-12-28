const express = require('express');
const app = express();
const port = 3000;
const dotenv = require('dotenv');
const router = require('./routes/routes');
const cookieParser = require('cookie-parser');
dotenv.config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Root route
app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.use('/api/v1',router)

app.use((req, res) => {
    res.status(404).send('Route not found');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at ${port}`);
});
