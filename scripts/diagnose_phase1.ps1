# Phase 1A/1B Diagnostics - CNC Shop Floor Management
# Usage: ./scripts/diagnose_phase1.ps1 -BaseUrl http://localhost:5000 -AdminUser ADMIN001 -AdminPass admin123
param(
  [string]$BaseUrl = "http://localhost:5000",
  [string]$AdminUser = "ADMIN001",
  [string]$AdminPass = "admin123"
)

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','DELETE','PATCH')][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter()][hashtable]$Headers,
    [Parameter()][object]$Body
  )
  $params = @{ Method = $Method; Uri = $Url; ErrorAction = 'SilentlyContinue' }
  if ($Headers) { $params['Headers'] = $Headers }
  if ($Body) { $params['ContentType'] = 'application/json'; $params['Body'] = ($Body | ConvertTo-Json -Depth 10) }
  try { Invoke-RestMethod @params } catch { return $null }
}

function Banner($text) { Write-Host "`n==== $text ====`n" }

$api = "$BaseUrl/api"

Banner "1) Ping backend"
try { $code = (Invoke-WebRequest -Uri "$api/materials" -Method GET -ErrorAction SilentlyContinue).StatusCode }
catch { $code = 0 }
if ($code -in 200,401,403) { Write-Host "Backend reachable at $BaseUrl" }
else { Write-Error "Backend not reachable at $BaseUrl (HTTP $code)"; exit 1 }

Banner "2) Login as admin ($AdminUser)"
$login = Invoke-JsonRequest -Method POST -Url "$api/auth/login" -Body @{ employee_id=$AdminUser; password=$AdminPass }
if (-not $login -or -not $login.token) { Write-Error "Login failed"; $login | ConvertTo-Json -Depth 10; exit 1 }
$token = $login.token
Write-Host "Login OK"

$auth = @{ Authorization = "Bearer $token" }

Banner "3) Check materials"
$mats = Invoke-JsonRequest -Method GET -Url "$api/materials" -Headers $auth
$count = if ($mats.total) { [int]$mats.total } elseif ($mats.materials) { $mats.materials.Count } else { 0 }
if ($count -eq 0) { Write-Warning "No materials found. Consider loading test data." } else { Write-Host "Materials: $count found" }

Banner "4) Create test order"
$today = (Get-Date).ToString('yyyy-MM-dd')
$due = (Get-Date).AddDays(7).ToString('yyyy-MM-dd')
$orderBody = @{
  customer_name = "Diag Customer"
  customer_email = "diag@example.com"
  customer_phone = ""
  order_date = $today
  due_date = $due
  notes = "diagnostic order"
  parts = @(@{ part_name = "diag-part"; description = ""; quantity = 1; material_id = 1 })
}
$create = Invoke-JsonRequest -Method POST -Url "$api/orders" -Headers $auth -Body $orderBody
if (-not $create -or -not $create.success) { Write-Error "Order create FAILED"; $create | ConvertTo-Json -Depth 10; exit 2 }
$orderId = $create.order.id
if (-not $orderId) { Write-Error "Missing order id in response"; $create | ConvertTo-Json -Depth 10; exit 2 }
Write-Host "Order created with id: $orderId"

Banner "5) List orders"
$orders = Invoke-JsonRequest -Method GET -Url "$api/orders" -Headers $auth
$ocnt = if ($orders.total) { [int]$orders.total } elseif ($orders.orders) { $orders.orders.Count } else { 0 }
Write-Host "Orders returned: $ocnt"

Banner "6) Fetch order by id ($orderId)"
$one = Invoke-JsonRequest -Method GET -Url "$api/orders/$orderId" -Headers $auth
if (-not $one -or -not $one.success) { Write-Error "Fetch order FAILED"; $one | ConvertTo-Json -Depth 10; exit 3 }
Write-Host ("Fetch OK. Customer: {0}" -f $one.order.customer_name)

Write-Host "`nAll checks passed. Phase 1A create/list/get is working."