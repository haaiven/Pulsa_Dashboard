# Pulsa Reconciliation Dashboard Requirements

Version: 1.0

## 1. Objective

Membangun aplikasi Dashboard Rekonsiliasi Pulsa yang mengimpor file
Excel rekonsiliasi harian dan menyajikan dashboard harian, mingguan, dan
bulanan.

Aplikasi **bukan** sistem transaksi, melainkan sistem monitoring,
reporting, dan rekonsiliasi.

## 2. Technology Stack

### Frontend

-   Next.js 15
-   React + TypeScript
-   TailwindCSS
-   shadcn/ui
-   TanStack Table
-   Recharts
-   React Query
-   Axios

### Backend

-   Python
-   FastAPI
-   uv (package manager)
-   SQLAlchemy 2.x
-   Alembic
-   Pydantic v2
-   pandas
-   openpyxl

### Database

-   SQLite

------------------------------------------------------------------------

## 3. Business Flow

Provider → Aggregator → Switch Platform → Agent → Channel → Product →
Daily Summary → Import Excel → Dashboard

------------------------------------------------------------------------

## 4. Master Data

### Provider

-   id
-   code
-   name
-   active

### Aggregator

-   id
-   code
-   name
-   active

### Switch Platform

-   id
-   code
-   name
-   location
-   active

### Agent

-   id
-   code
-   name
-   active

### Channel

-   id
-   agent_id
-   code
-   name
-   active

### Product

-   id
-   provider_id
-   category
-   code
-   name
-   nominal
-   active

### Route

Menyimpan routing Provider → Aggregator → Switch → Agent → Channel →
Product

Field: - id - provider_id - aggregator_id - switch_platform_id -
agent_id - channel_id - product_id - priority - active

------------------------------------------------------------------------

## 5. Operational Tables

### Import Batch

-   id
-   batch_no
-   upload_date
-   file_name
-   sheet_name
-   records
-   status
-   created_at

Status: - UPLOADED - PROCESSING - SUCCESS - FAILED

### Daily Summary

-   id
-   trx_date
-   route_id
-   total_transaction
-   success_transaction
-   pending_transaction
-   failed_transaction
-   gross_amount
-   settlement_amount
-   difference_amount
-   created_at

### Recon Result

-   id
-   daily_summary_id
-   recon_type
-   description
-   system_value
-   external_value
-   difference
-   status

### Exception Detail

-   id
-   daily_summary_id
-   exception_type
-   reference_number
-   product_code
-   amount
-   reason
-   created_at

------------------------------------------------------------------------

## 6. Excel Import

Importer harus membaca worksheet berikut:

-   summary
-   from_db
-   from_dana
-   harga_berbeda
-   ada_di_dana_tidak_di_db
-   ada_di_db_tidak_di_dana
-   force_failed
-   db_only_ext_check
-   dana_only_ext_check

Importer tidak boleh bergantung pada posisi cell, tetapi berdasarkan
nama worksheet dan mapping.

------------------------------------------------------------------------

## 7. Dashboard

### Overview

-   Total Transaction
-   Success
-   Pending
-   Failed
-   Settlement
-   Difference
-   Match Rate
-   Mismatch Rate

Filter: - Tanggal - Provider - Aggregator - Switch - Agent - Channel -
Product

### Dashboard

-   Harian
-   Mingguan
-   Bulanan
-   Trend
-   Recon
-   Exception

### Drill Down

Tanggal → Provider → Aggregator → Switch Platform → Agent → Channel →
Product

------------------------------------------------------------------------

## 8. API

### Master

-   GET /providers
-   GET /aggregators
-   GET /switch-platforms
-   GET /agents
-   GET /channels
-   GET /products
-   GET /routes

### Dashboard

-   GET /dashboard/overview
-   GET /dashboard/daily
-   GET /dashboard/weekly
-   GET /dashboard/monthly
-   GET /dashboard/trend
-   GET /dashboard/recon

### Import

-   POST /import/excel
-   GET /import/history
-   GET /import/{id}

### Exception

-   GET /exceptions
-   GET /exceptions/{id}

------------------------------------------------------------------------

## 9. Security

JWT Authentication

Roles: - Admin - Operator - Viewer

------------------------------------------------------------------------

## 10. Non Functional Requirements

-   Responsive UI
-   Dashboard \<2 detik
-   Import hingga 100.000 baris
-   Logging import
-   Retry import
-   REST API
-   SQLite
-   FastAPI
-   uv
-   Next.js
