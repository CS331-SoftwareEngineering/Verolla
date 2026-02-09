

---

## Metric Class

### Attributes

| Attribute      | Visibility | Description                         |
|---------------|------------|-------------------------------------|
| metricId      | private    | Unique identifier for the metric    |
| metricName    | private    | Name of the metric (CPU, Memory)    |
| metricValue   | private    | Current value of the metric         |
| unit          | private    | Unit of measurement (%) / MB        |
| timestamp     | private    | Time when metric was collected      |
| status        | private    | Normal / Warning / Critical         |

### Methods

| Method              | Visibility | Purpose                                           |
|---------------------|------------|---------------------------------------------------|
| collectMetric()     | public     | Collects the current metric value from the system |
| updateMetricValue() | public     | Updates metric value and timestamp                |
| getMetricValue()    | public     | Returns the current metric value                  |
| evaluateStatus()    | public     | Determines the metric status                      |

---

## Threshold Class

### Attributes

| Attribute        | Visibility      | Description                           |
|------------------|---------------|---------------------------------------|
| thresholdId      | private final | Unique identifier for the threshold   |
| metricName       | private       | Metric to which threshold applies     |
| thresholdValue   | private       | Limit value for triggering an alert   |
| comparisonType   | private       | >, <, ≥, ≤ condition                  |

### Methods

| Method                                    | Visibility | Purpose                                                                         |
|-------------------------------------------|------------|---------------------------------------------------------------------------------|
| isThresholdBreached(double metricValue)   | public     | Checks if metric value violates threshold                                       |
| updateThreshold()                         | public     | Updates the threshold value                                                      |
| getThresholdValue()                       | public     | Returns the threshold value                                                      |

---

## Alert Class

### Attributes

| Attribute        | Visibility      | Description                       |
|------------------|---------------|-----------------------------------|
| alertId          | private final | Unique identifier for the alert   |
| metricName       | private       | Metric that caused the alert      |
| currentValue     | private       | Metric value at alert time        |
| thresholdValue   | private       | Violated threshold value          |
| severity         | private       | Low / Medium / High               |
| status           | private       | New / Acknowledged / Resolved     |
| message          | private       | Alert description                 |
| timestamp        | private       | Time of alert generation          |

### Methods

| Method               | Visibility | Purpose                                       |
|----------------------|------------|-----------------------------------------------|
| generateAlert()      | public     | Creates an alert when threshold is breached   |
| acknowledgeAlert()   | public     | Marks alert as acknowledged                   |
| resolveAlert()       | public     | Closes the alert                              |
| updateStatus()       | public     | Updates alert status                          |
| getAlertDetails()    | public     | Returns alert information                    |

---

## Notification Class

### Attributes

| Attribute          | Visibility      | Description                               |
|--------------------|---------------|-------------------------------------------|
| notificationId     | private final | Unique identifier                          |
| notificationType   | private       | Email / SMS                               |
| recipient          | private       | Email address or phone number             |
| message            | private       | Notification content                      |
| timestamp          | private       | Time when notification was sent           |
| status             | private       | Sent / Failed / Pending                   |

### Methods

| Method               | Visibility | Purpose                                         |
|----------------------|------------|-------------------------------------------------|
| sendNotification()   | public     | Sends notification                              |
| sendEmail()          | public     | Sends email notification                        |
| sendSMS()            | public     | Sends SMS notification                          |
| updateStatus()       | private    | Updates delivery status                         |
| formatMessage()      | private    | Formats notification message                   |

---

## Dashboard Class

### Attributes

| Attribute           | Visibility | Description                       |
|---------------------|------------|-----------------------------------|
| systemStatus        | private    | Overall system health             |
| activeAlertsCount   | private    | Number of active alerts           |
| lastUpdatedTime     | private    | Last dashboard refresh time       |

### Methods

| Method                    | Visibility | Purpose                                       |
|---------------------------|------------|-----------------------------------------------|
| viewMetricStatistics()    | public     | Displays metric statistics                    |
| viewAlerts()              | public     | Displays current alerts                       |
| viewAlertHistory()        | public     | Displays alert history                        |
| viewSystemStatus()        | public     | Displays system status                        |
| refreshDashboard()        | public     | Refreshes dashboard data                      |
| updateLastUpdatedTime()   | private    | Updates refresh timestamp                     |

---

## Admin Class

### Attributes

| Attribute        | Visibility      | Description                           |
|------------------|---------------|---------------------------------------|
| adminId          | private final | Unique identifier for admin           |
| adminLevel       | private       | Privilege level                       |
| assignedSystem   | private       | Managed system/module                |

### Methods

| Method                 | Visibility | Purpose                                      |
|------------------------|------------|----------------------------------------------|
| configureThreshold()   | public     | Sets or updates thresholds                   |
| manageUsers()          | public     | Manages users                                |
| monitorSystem()        | public     | Monitors system health                      |
| viewDashboard()        | public     | Views dashboard                              |
| resolveAlert()         | public     | Resolves active alerts                      |

---

## UserService Class

### Methods

| Method                  | Visibility | Purpose                                        |
|-------------------------|------------|-----------------------------------------------|
| registerUser()          | public     | Registers a new user                          |
| validateUserDetails()   | private    | Validates user data                           |
| isUserExists()          | private    | Checks if user already exists                 |
| updateUserProfile()     | public     | Updates user profile                          |
| getUserById()           | public     | Retrieves user by ID                          |
| deleteUser()            | public     | Deletes or deactivates user                   |

---

## User Class

### Attributes

| Attribute          | Visibility      | Description                            |
|--------------------|---------------|----------------------------------------|
| userId             | private final | Unique identifier                      |
| username           | private       | Login username                         |
| fullName           | private       | Full name                              |
| organizationName   | private       | Organization                           |
| emailId            | private       | Email address                          |
| phoneNumber        | private       | Phone number                           |
| dateOfBirth        | private       | Date of birth                          |
| password           | private       | Encrypted password                     |
| role               | protected     | Admin / Registered User                |

### Methods

| Method          | Visibility | Purpose                                  |
|-----------------|------------|------------------------------------------|
| login()         | public     | Authenticates the user                   |
| logout()        | public     | Ends user session                        |
| updateProfile() | public     | Updates user profile details             |

---
