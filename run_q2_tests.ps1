# Verolla Q2 — Test Execution Script (corrected for real API contract)
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$results = New-Object System.Collections.ArrayList

function Hit($method, $path, $body, $headers) {
    $params = @{ Uri = "$base$path"; Method = $method; UseBasicParsing = $true; ErrorAction = 'Stop' }
    if ($headers) { $params.Headers = $headers }
    if ($body) { $params.ContentType = 'application/json'; $params.Body = ($body | ConvertTo-Json -Compress) }
    try {
        $r = Invoke-WebRequest @params
        return @{ status = [int]$r.StatusCode; body = ($r.Content | ConvertFrom-Json) }
    } catch {
        $code = 0; $text = $null
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            try {
                $s = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $raw = $s.ReadToEnd()
                if ($raw) { try { $text = $raw | ConvertFrom-Json } catch { $text = $raw } }
            } catch {}
        }
        return @{ status = $code; body = $text }
    }
}

function TC($id, $desc, $pass, $detail) {
    $status = if ($pass) { 'PASS' } else { 'FAIL' }
    Write-Host ''
    Write-Host ('--- ' + $id + ' : ' + $desc + ' ---')
    Write-Host ('  Detail : ' + $detail)
    Write-Host ('  Status : ' + $status)
    [void]$results.Add([pscustomobject]@{ TC = $id; Status = $status; Description = $desc; Detail = $detail })
}

function NewSignupBody($u) {
    return @{
        fullName        = 'Test User'
        username        = $u
        org             = 'TestOrg'
        email           = "$u@example.com"
        phone           = '9876543210'
        dob             = '2000-01-01'
        password        = 'StrongP@ss123'
        confirmPassword = 'StrongP@ss123'
    }
}

# TC-01
$u1 = 'tester' + (Get-Random -Maximum 99999)
$r = Hit 'POST' '/api/signup' (NewSignupBody $u1)
TC 'TC-01' 'Successful signup' (($r.status -eq 201 -or $r.status -eq 200) -and $r.body.success -eq $true) ("HTTP=$($r.status) id=$($r.body.user.id) username=$($r.body.user.username)")

# TC-02
$dup = NewSignupBody 'tejeshwar'; $dup.email = 'newunique@example.com'
$r = Hit 'POST' '/api/signup' $dup
TC 'TC-02' 'Duplicate username rejected' (($r.status -eq 400 -or $r.status -eq 409) -and ($r.body.message -match 'taken|exists|already')) ("HTTP=$($r.status) msg=$($r.body.message)")

# TC-03
$r = Hit 'POST' '/api/login' @{ identifier = 'tejeshwar'; password = 'Admin@123' }
TC 'TC-03' 'Login correct credentials returns role=admin' ($r.status -eq 200 -and $r.body.user.role -eq 'admin') ("HTTP=$($r.status) role=$($r.body.user.role)")

# TC-04
$r = Hit 'POST' '/api/login' @{ identifier = 'tejeshwar'; password = 'WrongPwd9' }
TC 'TC-04' 'Wrong password rejected (401)' ($r.status -eq 401) ("HTTP=$($r.status) msg=$($r.body.message)")

# Setup victim
$victim = 'victim' + (Get-Random -Maximum 99999)
Hit 'POST' '/api/signup' (NewSignupBody $victim) | Out-Null
$victimId = ((Hit 'GET' '/api/users' $null $null).body.users | Where-Object { $_.username -eq $victim } | Select-Object -First 1).id
$adminHdr = @{ 'x-admin-user' = 'tejeshwar' }

# TC-05
Hit 'POST' "/api/admin/users/$victimId/active" @{ active = $false } $adminHdr | Out-Null
$r = Hit 'POST' '/api/login' @{ identifier = $victim; password = 'StrongP@ss123' }
TC 'TC-05' 'Disabled user cannot login (403)' ($r.status -eq 403) ("HTTP=$($r.status) msg=$($r.body.message)")
Hit 'POST' "/api/admin/users/$victimId/active" @{ active = $true } $adminHdr | Out-Null

# TC-06
$r = Hit 'GET' '/api/admin/stats' $null $adminHdr
TC 'TC-06' 'Admin reaches /api/admin/stats' ($r.status -eq 200 -and $r.body.success -eq $true) ("HTTP=$($r.status) users=$($r.body.users) admins=$($r.body.admins) alertsActive=$($r.body.alertsActive)")

# TC-07
$r = Hit 'GET' '/api/admin/stats' $null @{ 'x-admin-user' = 'nobody_' + (Get-Random) }
TC 'TC-07' 'Non-admin denied admin endpoint (403)' ($r.status -eq 403) ("HTTP=$($r.status)")

# TC-08
$r = Hit 'POST' "/api/admin/users/$victimId/reset-password" $null $adminHdr
$tmp = $r.body.tempPassword
$loginAfter = if ($tmp) { Hit 'POST' '/api/login' @{ identifier = $victim; password = $tmp } } else { @{ status = 0 } }
TC 'TC-08' 'Admin reset password works on next login' ($r.status -eq 200 -and $tmp -and $loginAfter.status -eq 200) ("temp='$tmp' loginAfterStatus=$($loginAfter.status)")

Write-Host ''
Write-Host '======================================================================'
Write-Host '                      EXECUTION SUMMARY'
Write-Host '======================================================================'
$results | Format-Table -AutoSize TC, Status, Description
$pass = ($results | Where-Object Status -eq 'PASS').Count
$fail = ($results | Where-Object Status -eq 'FAIL').Count
Write-Host ("Total: " + $results.Count + "    Pass: " + $pass + "    Fail: " + $fail)
