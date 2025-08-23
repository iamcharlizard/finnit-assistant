# Finnit Assistant API - Postman Collection

This directory contains a comprehensive Postman Collection for testing and exploring the Finnit Assistant GraphQL API.

## 📁 Files Overview

- **`Finnit-Assistant-API.postman_collection.json`** - Main collection with all API endpoints
- **`Development.postman_environment.json`** - Environment for local development
- **`Staging.postman_environment.json`** - Environment for staging server
- **`Production.postman_environment.json`** - Environment for production server
- **`README.md`** - This documentation file

## 🚀 Quick Start

### 1. Import Collection and Environment

1. **Import the Collection:**
   - Open Postman
   - Click "Import" → Select `Finnit-Assistant-API.postman_collection.json`

2. **Import Environments:**
   - Import all three environment files:
     - `Development.postman_environment.json`
     - `Staging.postman_environment.json` 
     - `Production.postman_environment.json`

3. **Select Environment:**
   - Choose "Development" for local testing
   - Top-right corner dropdown → Select "Finnit Assistant - Development"

### 2. Start Your Local API Server

```bash
# Make sure your database is running
docker-compose up -d postgres

# Start the API server
yarn api:dev
# or
turbo run start:dev --filter=@finnit/api
```

Your API should be available at `http://localhost:3000` with GraphQL playground at `http://localhost:3000/graphql`.

### 3. Test the Collection

1. **Health Check:**
   - Go to "General" folder → "Health Check"
   - Click "Send" (should return API status)

2. **Authentication Flow:**
   - Go to "🔐 Authentication" folder
   - Start with "Register User" or "Login"
   - The access token will be automatically saved to environment variables

## 📚 Collection Structure

### 🔐 Authentication
Complete user authentication workflow including:
- **Register User** - Create new user account
- **Login** - Authenticate and get tokens
- **Refresh Token** - Renew access token
- **Logout** - End user session
- **Request Password Reset** - Password recovery
- **Validate Token** - Check token validity
- **Current User** - Get authenticated user info

### 👤 Users
User profile management:
- **Get User Profile** - Retrieve user information
- **Update User Profile** - Modify user details

### 🏦 Accounts
Financial account management:
- **Get All Accounts** - List user accounts with pagination
- **Get Account by ID** - Retrieve specific account details
- **Create Account** - Add new financial account
- **Update Account** - Modify account information
- **Archive Account** - Soft delete account
- **Delete Account** - Permanently remove account

### 💸 Transactions
Transaction management system:
- **Get All Transactions** - List transactions with filtering
- **Get Transaction by ID** - Retrieve transaction details
- **Create Transaction** - Record new transaction
- **Update Transaction** - Modify transaction details
- **Delete Transaction** - Remove transaction
- **Add Transaction Attachment** - Upload receipt/document
- **Remove Transaction Attachment** - Delete attachment

### 🔄 Transfers
Money transfer between accounts:
- **Get All Transfers** - List account transfers
- **Get Transfer by ID** - Transfer details
- **Create Transfer** - Move money between accounts

### 🏷️ Categories
Transaction categorization:
- **Get All Categories** - List available categories
- **Get User Categories** - User-specific categories
- **Get Category by ID** - Category details
- **Create Category** - Add new category
- **Update Category** - Modify category
- **Delete Category** - Remove category
- **Get Category Usage** - Usage statistics
- **Suggest Category** - AI-powered categorization

### 💰 Budgets
Budget planning and tracking:
- **Get All Budgets** - List user budgets
- **Get Budget by ID** - Budget details
- **Get Budget Usage** - Spending vs budget analysis
- **Get Current Budget** - Active month budget
- **Get Budget Summary** - Monthly overview
- **Get Budget Alerts** - Over-budget notifications
- **Create Budget** - Set up new budget
- **Update Budget** - Modify budget
- **Delete Budget** - Remove budget
- **Copy Budget from Previous Month** - Quick budget setup

### 🎯 Goals
Financial goal setting and tracking:
- **Get All Goals** - List financial goals
- **Get Goal by ID** - Goal details
- **Get Goal Progress** - Track progress toward goal
- **Create Goal** - Set new financial goal

### 💳 Debts
Debt management and payment tracking:
- **Get All Debts** - List user debts
- **Get Debt by ID** - Debt details
- **Get Debt Summary** - Overview of all debts
- **Get Debt Payoff Projections** - Payment scenarios
- **Create Debt** - Add new debt
- **Update Debt** - Modify debt details
- **Delete Debt** - Remove debt
- **Record Debt Payment** - Track payments

### 🔔 Notifications
Notification management:
- **Get All Notifications** - List user notifications
- **Mark Notification as Read** - Update notification status
- **Mark All Notifications as Read** - Bulk status update

### 📊 Reports
Financial reporting and analytics:
- **Get Monthly Report** - Comprehensive monthly analysis
- **Get Cash Flow Projection** - Future cash flow predictions
- **What-If Analysis** - Financial scenario planning

### 🏠 General
System endpoints:
- **Health Check** - API status
- **GraphQL Schema Introspection** - Explore API schema

## 🔧 Environment Variables

### Automatically Managed
These variables are set automatically by scripts:
- `access_token` - JWT access token (set after login)
- `refresh_token` - JWT refresh token (set after login)  
- `user_id` - Current user ID (set after login)
- `account_id` - Account ID (set after account creation)
- `transaction_id` - Transaction ID (set after transaction creation)
- `category_id` - Category ID (set after category creation)
- `current_date`, `current_year`, `current_month` - Dynamic date values

### Manual Configuration Required
Update these variables for your testing:

**Development Environment:**
- `user_email` - Your test email address
- `user_password` - Your test password
- `user_name` - Your test user name

**Production Environment:**
- `base_url` - Update to your production API URL
- `user_email` - Your production email (⚠️ **CHANGE THIS**)
- `user_password` - Your production password (⚠️ **CHANGE THIS**)

## 🔐 Authentication Flow

### Step 1: Register or Login
```graphql
# Register New User
mutation RegisterUser($input: RegisterInput!) {
  register(input: $input) {
    user { id, name, email }
    accessToken
    refreshToken
  }
}

# Or Login Existing User
mutation Login($input: LoginInput!) {
  login(input: $input) {
    user { id, name, email }
    accessToken
    refreshToken
  }
}
```

### Step 2: Automatic Token Management
The collection automatically:
- Saves tokens from login/register responses
- Adds `Authorization: Bearer {{access_token}}` to authenticated requests
- Refreshes tokens when needed

### Step 3: Use Authenticated Endpoints
Once logged in, all other endpoints in the collection will automatically include your authentication token.

## 🧪 Testing Workflows

### Basic Workflow
1. **Register/Login** → Get authentication tokens
2. **Create Account** → Set up a financial account
3. **Create Category** → Set up transaction categories
4. **Create Transaction** → Record a financial transaction
5. **Create Budget** → Set up monthly budget
6. **View Reports** → Analyze your financial data

### Advanced Workflow
1. **Setup Multiple Accounts** → Checking, Savings, Credit Card
2. **Create Transfer** → Move money between accounts
3. **Setup Goals** → Emergency fund, vacation savings
4. **Manage Debts** → Track loans and payments
5. **Budget Analysis** → Monitor spending vs budget
6. **Financial Reports** → Monthly analysis and projections

## 📝 GraphQL Query Examples

### Get All Transactions with Filters
```graphql
query GetTransactions($first: Int, $accountId: String, $type: TransactionType) {
  transactions(first: $first, accountId: $accountId, type: $type) {
    edges {
      node {
        id
        amount
        description
        txnDate
        account { name }
        category { name }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Create Budget with Categories
```graphql
mutation CreateBudget($input: CreateBudgetInput!) {
  createBudget(input: $input) {
    id
    year
    month
    amountTotal
    categories {
      capAmount
      category { name }
    }
  }
}
```

### Monthly Financial Report
```graphql
query GetMonthlyReport($year: Int!, $month: Int!) {
  monthlyReport(year: $year, month: $month) {
    totalIncome
    totalExpenses
    netIncome
    categoryBreakdown {
      categoryName
      amount
      percentage
    }
  }
}
```

## ⚙️ Advanced Configuration

### Custom Pre-request Scripts
The collection includes pre-request scripts that automatically:
- Set current date variables
- Calculate date ranges for reports
- Generate dynamic test data

### Custom Test Scripts
Post-response scripts automatically:
- Extract and save tokens from authentication responses
- Save created resource IDs for subsequent requests
- Validate response structure

### Environment Switching
Easily switch between environments:
- **Development** - `http://localhost:3000`
- **Staging** - `https://api-staging.finnit.app`
- **Production** - `https://api.finnit.app`

## 🚨 Security Best Practices

### Development
- Use test data only
- Don't commit real credentials to version control
- Regularly rotate test passwords

### Staging
- Use staging-specific test accounts
- Don't use production data
- Keep staging credentials separate

### Production
- **NEVER** use default credentials
- Use strong, unique passwords
- Implement proper access controls
- Monitor API usage

## 🔄 API Updates

When the API changes:
1. **Update Collection** - Import new version of collection
2. **Update Environment** - Add new environment variables if needed
3. **Test Workflow** - Verify existing requests still work
4. **Document Changes** - Update this README if needed

## 🐛 Troubleshooting

### Common Issues

**Authentication Errors:**
- Ensure you're logged in first
- Check if your token has expired
- Verify the correct environment is selected

**GraphQL Errors:**
- Check GraphQL syntax in request body
- Verify variable names match the query
- Use GraphQL playground for testing queries

**Environment Issues:**
- Ensure correct environment is selected
- Check that required variables are set
- Verify base URL is correct for your setup

**Network Errors:**
- Confirm API server is running (for Development)
- Check if ports are correct
- Verify firewall/proxy settings

### Debug Tips
1. **Use Console** - Check Postman Console for detailed request/response logs
2. **Enable Debug Mode** - Turn on request debugging in Postman
3. **Test Individual Queries** - Use GraphQL Playground for query testing
4. **Check Variables** - Verify environment variables are populated correctly

## 📞 Support

For API-related issues:
- Check the GraphQL playground at `/graphql`
- Review API documentation
- Check server logs for detailed error information

For collection-related issues:
- Verify Postman version compatibility
- Check environment variable configuration
- Review pre-request and test scripts

---

**Last Updated:** January 2025  
**API Version:** v1.0.0  
**Postman Collection Version:** v1.0.0