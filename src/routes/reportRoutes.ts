import { Router } from "express"
import { ReportController } from "../controllers/ReportController"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { UserRole } from "../enums/UserRole"
import { param } from "express-validator"

const router = Router()

// Routes with authentication and authorization
router.get(
  "/product-type/:id/profit",
  authenticate,
  authorize([UserRole.ADMIN]),
  param("id").isInt().withMessage("Product type ID must be an integer"),
  ReportController.productTypeProfitReport,
)

router.get("/inventory-value", authenticate, authorize([UserRole.ADMIN]), ReportController.inventoryValueReport)

router.get("/sales-performance", authenticate, authorize([UserRole.ADMIN]), ReportController.salesPerformanceReport)

export default router
