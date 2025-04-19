import express, { type Application, type Request, type Response, type NextFunction } from "express"
import morgan from "morgan"
import AuthRoutes from "./routes/authRoutes"
import AdminRoutes from "./routes/adminRoutes"
import EmployeeRoutes from "./routes/employeeRoutes"
import ProductTypeRoutes from "./routes/productTypeRoutes"
import ProductRoutes from "./routes/productRoutes"
import StockMovementRoutes from "./routes/stockMovementRoutes"
import ReportRoutes from "./routes/reportRoutes"

import "reflect-metadata"
import cors from "cors"

const app: Application = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Original routes
app.use("/api/user/", AuthRoutes)
app.use("/api/admin/", AdminRoutes)
app.use("/api/employee/", EmployeeRoutes)

// New enhanced routes
app.use("/api/product-types", ProductTypeRoutes)
app.use("/api/products", ProductRoutes)
app.use("/api/stock-movements", StockMovementRoutes)
app.use("/api/reports", ReportRoutes)

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome To The StockTrack API" })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ message: "Internal server error" })
})

export default app
