const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const siteRoutes = require("./routes/siteRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const unitRoutes = require("./routes/unitRoutes"); // Import the Unit routes
const itemRoutes = require("./routes/itemRoutes"); // Import the Unit routes
const supplierRoutes = require("./routes/supplierRoutes");
const siteInventoryRoutes = require("./routes/siteInventoryRoutes");
const marterilRequestRoutes = require("./routes/materialRequestRoute");
const inventoryRoutes = require("./routes/inventoryRoutes");
const materialIssueRoutes = require('./routes/materialIssueRoutes')
// const PurchaseOrderPlanning = require('./routes/purchaseOrderPlanningRoutes'); // Import the PurchaseOrderPlanning model
const cors = require("cors"); // Import the CORS package

const path = require("path");
dotenv.config();
connectDB();

const app = express();

// Use CORS middleware
app.use(cors()); // This will allow all domains to access your API

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/site", siteRoutes);
app.use("/api/user", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/unit", unitRoutes);
app.use("/api/item", itemRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/site-inventory", siteInventoryRoutes);
app.use("/api/material-request", marterilRequestRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use('/api/material-issue' ,materialIssueRoutes )


app.use('/', (req, res )=>{
    res.send(`Server Runiing on port ${ process.env.PORT }`)
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
