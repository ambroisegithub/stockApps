import { Router } from "express"
import { ProductTypeController } from "../controllers/ProductTypeController"
import { authenticate, authorize } from "../middlewares/authMiddleware"
import { UserRole } from "../enums/UserRole"
import { body, param } from "express-validator"

const router = Router()

// Validation rules for creating product type
const createProductTypeValidation = [
  body("name").notEmpty().trim().withMessage("Product type name is required"),
  body("description").optional().trim(),
]

// Validation rules for updating product type
const updateProductTypeValidation = [
  param("id").isInt().withMessage("Product type ID must be an integer"),
  body("name").optional().trim(),
  body("description").optional().trim(),
]

// Routes with authentication and authorization
router.post(
  "/",
  authenticate,
  authorize([UserRole.ADMIN]),
  createProductTypeValidation,
  ProductTypeController.createProductType,
)

router.get("/", authenticate, ProductTypeController.listProductTypes)

router.get(
  "/:id",
  authenticate,
  param("id").isInt().withMessage("Product type ID must be an integer"),
  ProductTypeController.getProductTypeWithProducts,
)

router.put(
  "/:id",
  authenticate,
  authorize([UserRole.ADMIN]),
  updateProductTypeValidation,
  ProductTypeController.updateProductType,
)

export default router
