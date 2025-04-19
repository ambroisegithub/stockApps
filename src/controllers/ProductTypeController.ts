import type { Request, Response } from "express"
import { validationResult } from "express-validator"
import dbConnection from "../database"
import { ProductType } from "../database/models/ProductType"

export class ProductTypeController {
  // Create a new product type
  static async createProductType(req: Request, res: Response) {
    try {
      // Validate request
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const productTypeRepository = dbConnection.getRepository(ProductType)

      // Extract product type data from request body
      const { name, description } = req.body

      // Check if product type with the same name already exists
      const existingProductType = await productTypeRepository.findOne({
        where: { name },
      })

      if (existingProductType) {
        return res.status(400).json({
          message: "Product type with this name already exists",
        })
      }

      // Create new product type
      const productType = productTypeRepository.create({
        name,
        description,
      })

      await productTypeRepository.save(productType)

      return res.status(201).json({
        message: "Product type created successfully",
        data: productType,
      })
    } catch (error) {
      console.error("Error creating product type:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }

  // List all product types
  static async listProductTypes(req: Request, res: Response) {
    try {
      const productTypeRepository = dbConnection.getRepository(ProductType)

      // Find all product types
      const productTypes = await productTypeRepository.find({
        order: { name: "ASC" },
      })

      return res.status(200).json({
        message: "Product types retrieved successfully",
        count: productTypes.length,
        data: productTypes,
      })
    } catch (error) {
      console.error("Error listing product types:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }

  // Get a single product type with its products
  static async getProductTypeWithProducts(req: Request, res: Response) {
    try {
      const productTypeRepository = dbConnection.getRepository(ProductType)
      const productTypeId = Number.parseInt(req.params.id)

      // Find product type with its products
      const productType = await productTypeRepository.findOne({
        where: { id: productTypeId },
        relations: ["products"],
      })

      if (!productType) {
        return res.status(404).json({ message: "Product type not found" })
      }

      return res.status(200).json({
        message: "Product type retrieved successfully",
        data: productType,
      })
    } catch (error) {
      console.error("Error getting product type:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }

  // Update a product type
  static async updateProductType(req: Request, res: Response) {
    try {
      // Validate request
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const productTypeRepository = dbConnection.getRepository(ProductType)
      const productTypeId = Number.parseInt(req.params.id)

      // Check if product type exists
      const productType = await productTypeRepository.findOne({
        where: { id: productTypeId },
      })

      if (!productType) {
        return res.status(404).json({ message: "Product type not found" })
      }

      // Extract update data
      const { name, description } = req.body

      // Check if another product type with the same name exists
      if (name && name !== productType.name) {
        const existingProductType = await productTypeRepository.findOne({
          where: { name },
        })

        if (existingProductType) {
          return res.status(400).json({
            message: "Another product type with this name already exists",
          })
        }
      }

      // Update product type
      productType.name = name || productType.name
      productType.description = description !== undefined ? description : productType.description

      await productTypeRepository.save(productType)

      return res.status(200).json({
        message: "Product type updated successfully",
        data: productType,
      })
    } catch (error) {
      console.error("Error updating product type:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }
}
