import type { Request, Response } from "express"
import dbConnection from "../database"
import { Sale } from "../database/models/Sale"
import { Product } from "../database/models/Product"
import { ProductType } from "../database/models/ProductType"
import { Between, MoreThan, In } from "typeorm"

export class ReportController {
  // Generate product type profit report
  static async productTypeProfitReport(req: Request, res: Response) {
    try {
      const productTypeId = Number.parseInt(req.params.id)
      const productTypeRepository = dbConnection.getRepository(ProductType)
      const productRepository = dbConnection.getRepository(Product)
      const saleRepository = dbConnection.getRepository(Sale)

      // Check if product type exists
      const productType = await productTypeRepository.findOne({
        where: { id: productTypeId },
      })

      if (!productType) {
        return res.status(404).json({ message: "Product type not found" })
      }

      // Get all products of this type
      const products = await productRepository.find({
        where: { productType: { id: productTypeId } },
      })

      if (products.length === 0) {
        return res.status(200).json({
          message: "No products found for this product type",
          data: {
            productType: productType.name,
            productCount: 0,
            totalSales: 0,
            totalProfit: 0,
            products: [],
          },
        })
      }

      // Get all approved sales for these products
      const productIds = products.map((product) => product.id)
      const sales = await saleRepository.find({
        where: {
          product: { id: In(productIds) },
          status: "approved",
        },
        relations: ["product"],
      })

      // Calculate totals
      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0)
      const totalProfit = sales.reduce((sum, sale) => sum + Number(sale.profit), 0)
      const totalQuantitySold = sales.reduce((sum, sale) => sum + Number(sale.qtySold), 0)

      // Calculate per-product metrics
      const productMetrics = await Promise.all(
        products.map(async (product) => {
          const productSales = sales.filter((sale) => sale.product.id === product.id)
          const productTotalSales = productSales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0)
          const productTotalProfit = productSales.reduce((sum, sale) => sum + Number(sale.profit), 0)
          const productQuantitySold = productSales.reduce((sum, sale) => sum + Number(sale.qtySold), 0)

          return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            currentStock: product.qtyInStock,
            currentStockValue: product.qtyInStock * product.costPrice,
            salesCount: productSales.length,
            quantitySold: productQuantitySold,
            totalSales: productTotalSales,
            totalProfit: productTotalProfit,
            profitMargin: productTotalSales > 0 ? (productTotalProfit / productTotalSales) * 100 : 0,
          }
        }),
      )

      // Sort products by profit (highest first)
      productMetrics.sort((a, b) => b.totalProfit - a.totalProfit)

      return res.status(200).json({
        message: "Product type profit report generated successfully",
        data: {
          productType: productType.name,
          productCount: products.length,
          totalSales,
          totalProfit,
          totalQuantitySold,
          profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
          products: productMetrics,
        },
      })
    } catch (error) {
      console.error("Error generating product type profit report:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }

  // Generate inventory value report
  static async inventoryValueReport(req: Request, res: Response) {
    try {
      const productRepository = dbConnection.getRepository(Product)
      const productTypeRepository = dbConnection.getRepository(ProductType)

      // Get all product types
      const productTypes = await productTypeRepository.find()

      // Get all products with stock
      const products = await productRepository.find({
        where: { qtyInStock: MoreThan(0) },
        relations: ["productType"],
      })

      // Calculate inventory value by product type
      const inventoryByType = productTypes.map((type) => {
        const typeProducts = products.filter((product) => product.productType.id === type.id)
        const typeInventoryValue = typeProducts.reduce(
          (sum, product) => sum + product.qtyInStock * product.costPrice,
          0,
        )
        const typePotentialProfit = typeProducts.reduce(
          (sum, product) => sum + product.qtyInStock * (product.price - product.costPrice),
          0,
        )

        return {
          productTypeId: type.id,
          productTypeName: type.name,
          productCount: typeProducts.length,
          totalItems: typeProducts.reduce((sum, product) => sum + product.qtyInStock, 0),
          inventoryValue: typeInventoryValue,
          potentialProfit: typePotentialProfit,
          products: typeProducts.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            qtyInStock: product.qtyInStock,
            costPrice: product.costPrice,
            price: product.price,
            inventoryValue: product.qtyInStock * product.costPrice,
            potentialProfit: product.qtyInStock * (product.price - product.costPrice),
          })),
        }
      })

      // Calculate totals
      const totalInventoryValue = inventoryByType.reduce((sum, type) => sum + type.inventoryValue, 0)
      const totalPotentialProfit = inventoryByType.reduce((sum, type) => sum + type.potentialProfit, 0)

      return res.status(200).json({
        message: "Inventory value report generated successfully",
        data: {
          totalInventoryValue,
          totalPotentialProfit,
          productTypeCount: productTypes.length,
          inventoryByType,
        },
      })
    } catch (error) {
      console.error("Error generating inventory value report:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }

  // Generate sales performance report
  static async salesPerformanceReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, productTypeId } = req.query
      const saleRepository = dbConnection.getRepository(Sale)
      const productTypeRepository = dbConnection.getRepository(ProductType)

      // Validate date range
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" })
      }

      // Build query conditions
      const queryConditions: any = {
        status: "approved",
        salesDate: Between(new Date(startDate as string), new Date(endDate as string)),
      }

      // Add product type filter if provided
      if (productTypeId) {
        // Check if product type exists
        const productType = await productTypeRepository.findOne({
          where: { id: Number(productTypeId) },
        })

        if (!productType) {
          return res.status(404).json({ message: "Product type not found" })
        }

        queryConditions.product = { productType: { id: Number(productTypeId) } }
      }

      // Get sales within date range
      const sales = await saleRepository.find({
        where: queryConditions,
        relations: ["product", "product.productType", "soldBy", "approvedBy"],
        order: { salesDate: "DESC" },
      })

      // Group sales by day
      const salesByDay = sales.reduce((acc, sale) => {
        const day = new Date(sale.salesDate).toISOString().split("T")[0]
        if (!acc[day]) {
          acc[day] = {
            date: day,
            salesCount: 0,
            totalSales: 0,
            totalProfit: 0,
            itemsSold: 0,
          }
        }
        acc[day].salesCount += 1
        acc[day].totalSales += Number(sale.totalPrice)
        acc[day].totalProfit += Number(sale.profit)
        acc[day].itemsSold += Number(sale.qtySold)
        return acc
      }, {})

      // Group sales by product type
      const salesByProductType = sales.reduce((acc, sale) => {
        const productTypeName = sale.product.productType.name
        const productTypeId = sale.product.productType.id

        if (!acc[productTypeId]) {
          acc[productTypeId] = {
            id: productTypeId,
            name: productTypeName,
            salesCount: 0,
            totalSales: 0,
            totalProfit: 0,
            itemsSold: 0,
          }
        }

        acc[productTypeId].salesCount += 1
        acc[productTypeId].totalSales += Number(sale.totalPrice)
        acc[productTypeId].totalProfit += Number(sale.profit)
        acc[productTypeId].itemsSold += Number(sale.qtySold)

        return acc
      }, {})

      // Calculate overall totals
      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0)
      const totalProfit = sales.reduce((sum, sale) => sum + Number(sale.profit), 0)
      const totalItemsSold = sales.reduce((sum, sale) => sum + Number(sale.qtySold), 0)

      return res.status(200).json({
        message: "Sales performance report generated successfully",
        data: {
          period: {
            startDate: startDate,
            endDate: endDate,
          },
          summary: {
            salesCount: sales.length,
            totalSales,
            totalProfit,
            totalItemsSold,
            profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
          },
          dailyBreakdown: Object.values(salesByDay),
          productTypeBreakdown: Object.values(salesByProductType),
        },
      })
    } catch (error) {
      console.error("Error generating sales performance report:", error)
      return res.status(500).json({ message: "Internal server error" })
    }
  }
}
