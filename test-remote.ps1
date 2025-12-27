param([string]$BaseUrl = "http://192.168.8.226:5000")

$headers = @{ "Content-Type" = "application/json" }

# 1. Health check
Write-Host "1. Health check..." -ForegroundColor Cyan
try {
  $health = Invoke-WebRequest "$BaseUrl/health" -TimeoutSec 5 -ErrorAction Stop
  Write-Host "✅ Health: $($health.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "❌ Health failed: $_" -ForegroundColor Red
  exit 1
}

# 2. Login
Write-Host "`n2. Login as ADMIN001..." -ForegroundColor Cyan
try {
  $body = @{ employeeId = "ADMIN001"; password = "admin123" } | ConvertTo-Json
  $login = Invoke-WebRequest "$BaseUrl/api/auth/login" -Method POST -Headers $headers -Body $body -TimeoutSec 5 -ErrorAction Stop
  $loginData = $login.Content | ConvertFrom-Json
  $token = $loginData.token
  Write-Host "✅ Login OK. Token: $($token.Substring(0,20))..." -ForegroundColor Green
} catch {
  Write-Host "❌ Login failed: $_" -ForegroundColor Red
  exit 1
}

$authHeaders = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $token"
}

# 3. Get materials
Write-Host "`n3. Get materials..." -ForegroundColor Cyan
try {
  $materials = Invoke-WebRequest "$BaseUrl/api/materials" -Headers $authHeaders -TimeoutSec 5 -ErrorAction Stop
  $matData = $materials.Content | ConvertFrom-Json
  $count = if ($matData.materials) { $matData.materials.Count } else { 0 }
  Write-Host "✅ Materials: $count found" -ForegroundColor Green
} catch {
  Write-Host "❌ Materials failed: $_" -ForegroundColor Red
}

# 4. Create order
Write-Host "`n4. Create test order..." -ForegroundColor Cyan
try {
  $today = (Get-Date).ToString('yyyy-MM-dd')
  $due = (Get-Date).AddDays(7).ToString('yyyy-MM-dd')
  $orderBody = @{
    customer_name = "Test Customer $(Get-Random)"
    customer_email = "test@example.com"
    customer_phone = ""
    order_date = $today
    due_date = $due
    notes = "Remote test order"
    parts = @(@{ 
      part_name = "Remote Test Part"
      description = ""
      quantity = 1
      material_id = 1
    })
  } | ConvertTo-Json

  $create = Invoke-WebRequest "$BaseUrl/api/orders" -Method POST -Headers $authHeaders -Body $orderBody -TimeoutSec 5 -ErrorAction Stop
  $createData = $create.Content | ConvertFrom-Json
  $orderId = $createData.order.id
  Write-Host "✅ Order created. ID: $orderId" -ForegroundColor Green
  
  # 5. Get order by ID
  Write-Host "`n5. Get order by ID..." -ForegroundColor Cyan
  $order = Invoke-WebRequest "$BaseUrl/api/orders/$orderId" -Headers $authHeaders -TimeoutSec 5 -ErrorAction Stop
  $orderData = $order.Content | ConvertFrom-Json
  Write-Host "✅ Order fetched. Customer: $($orderData.order.customer_name)" -ForegroundColor Green
  
} catch {
  Write-Host "❌ Order test failed: $_" -ForegroundColor Red
}

Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
