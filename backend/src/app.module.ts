import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SellersModule } from './sellers/sellers.module';
import { CustomersModule } from './customers/customers.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { InventoryModule } from './inventory/inventory.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { OrdersModule } from './orders/orders.module';
import { OrderItemsModule } from './order-items/order-items.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { ReviewsModule } from './reviews/reviews.module';
import { InquiriesModule } from './inquiries/inquiries.module';
import { DiscountRequestsModule } from './discount-requests/discount-requests.module';
import { AiModule } from './ai/ai.module';
import { CartsModule } from './carts/carts.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymeModule } from './payme/payme.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SellersModule,
    CustomersModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    WarehousesModule,
    InventoryModule,
    StockMovementsModule,
    OrdersModule,
    OrderItemsModule,
    PaymentsModule,
    InvoicesModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    AuditModule,
    ReviewsModule,
    InquiriesModule,
    DiscountRequestsModule,
    AiModule,
    CartsModule,
    CheckoutModule,
    PaymeModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
