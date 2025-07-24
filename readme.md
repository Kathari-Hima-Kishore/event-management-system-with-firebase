# Event Management System with Firebase

This is a full-stack event management web application built with a Flask backend and a robust Firebase integration for authentication and database services. The system features a sophisticated role-based access control system, allowing for different levels of user permissions (User, Admin, Developer).

The frontend is designed with a modern, responsive "glassmorphism" aesthetic and provides real-time updates and a seamless user experience for creating, managing, and enrolling in events.

## Key Features

### User Features
- **Secure Authentication**: Register and log in securely using Firebase Authentication (Email/Password).
- **View Public Events**: Browse a grid of all available events with details like date, location, and description.
- **Event Enrollment**: Easily enroll in or un-enroll from events with a single click.
- **Real-time Updates**: See changes to events, such as new enrollments, in real-time.

### Admin Features
- **Admin Dashboard**: A dedicated dashboard for managing events.
- **Event CRUD**: Create, read, update, and delete events. Admins can only manage events they have created.
- **Approval Workflow**: New admin accounts must be reviewed and approved by a Developer before gaining access to the admin dashboard.
- **View Statistics**: View enrollment counts and participant lists for created events.

### Developer Features
- **Developer Dashboard**: A super-admin dashboard with site-wide statistics and user management capabilities.
- **Real-time Stats**: View live counts of total users, pending admin approvals, and banned accounts.
- **User Management**: Ban or unban any User or Admin account.
- **Admin Approval**: Approve or deny registration requests from new Admins.
- **Secure Registration**: Developer role is protected by a secret registration code.

## Tech Stack

- **Backend**: Python, Flask
- **Frontend**: HTML, CSS, JavaScript
- **Authentication**: Firebase Authentication
- **Database**:
    - **Firestore**: For storing user and event data.
    - **Realtime Database**: For storing event images as base64 strings.
- **Deployment**: Gunicorn, Render
- **Python Libraries**: `firebase-admin`, `Flask`, `Flask-Caching`, `python-dotenv`

## Role-Based Access Control

The application implements a three-tier role system to manage permissions effectively:

1.  **User**: The standard role for participants. Can register, log in, view public events, and enroll/un-enroll from them.
2.  **Admin**: An event organizer. Has all the permissions of a User, plus the ability to create, edit, and delete their own events from a dedicated admin dashboard. Admin accounts are inactive until approved by a Developer.
3.  **Developer (Dev)**: A super-admin with the highest level of access. Developers can manage all users on the platform, including approving new admin accounts and banning users. Registration for this role requires a secret code.

## Local Setup and Installation

Follow these steps to run the project on your local machine.

### Prerequisites
- Python 3.10+
- `pip` package manager
- A Google Firebase project

### 1. Clone the Repository
```bash
git clone https://github.com/himakishore3003/event-management-system-with-firebase.git
cd event-management-system-with-firebase
```

### 2. Create a Virtual Environment
```bash
# For macOS/Linux
python3 -m venv venv
source venv/bin/activate

# For Windows
python -m venv venv
.\venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Firebase Project Setup
1.  Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  In your project, enable the following services:
    *   **Authentication**: Enable the "Email/Password" sign-in method.
    *   **Firestore Database**: Create a new database.
    *   **Realtime Database**: Create a new database.
3.  Go to **Project settings** > **Service accounts**.
4.  Click **Generate new private key** to download your service account JSON file.
5.  Go to **Project settings** > **General**. Under "Your apps", create a new Web App. Copy the `firebaseConfig` object provided.

### 5. Configure Environment Variables
Create a `.env` file in the root of the project directory and populate it with your Firebase credentials.

Your `.env` file should look like this:
```env
# Flask Secret Key
SECRET_KEY='your_strong_secret_key'

# Developer Registration Code
DEV_REGISTRATION_CODE='your_dev_secret_code' # e.g., 22127022

# Firebase Web App Config (from step 4.5)
FIREBASE_API_KEY='...'
FIREBASE_AUTH_DOMAIN='...'
FIREBASE_PROJECT_ID='...'
FIREBASE_STORAGE_BUCKET='...'
FIREBASE_MESSAGING_SENDER_ID='...'
FIREBASE_APP_ID='...'
FIREBASE_MEASUREMENT_ID='...'
FIREBASE_DATABASE_URL='...' # From your Realtime Database settings

# Firebase Service Account Credentials (from the JSON file downloaded in step 4.4)
FIREBASE_TYPE='service_account'
FIREBASE_PRIVATE_KEY_ID='...'
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" # IMPORTANT: Keep the \n characters
FIREBASE_CLIENT_EMAIL='...'
FIREBASE_CLIENT_ID='...'
FIREBASE_AUTH_URI='...'
FIREBASE_TOKEN_URI='...'
FIREBASE_AUTH_PROVIDER_X509_CERT_URL='...'
FIREBASE_CLIENT_X509_CERT_URL='...'
FIREBASE_UNIVERSE_DOMAIN='googleapis.com'
```

### 6. Run the Application
```bash
python app.py
```
The application will be available at `http://127.0.0.1:5000`.

## Usage
1.  **Register a Developer Account**: Navigate to `/register`, select the "Developer" role, and enter the `DEV_REGISTRATION_CODE` you set in your `.env` file.
2.  **Register an Admin Account**: Register a new account with the "Admin" role.
3.  **Approve the Admin**: Log in with your Developer account, go to the Dev Dashboard, and approve the pending Admin account.
4.  **Create Events**: Log in with the now-approved Admin account. From the Admin Dashboard, create new events.
5.  **Enroll in Events**: Register a standard "User" account or visit `/public-events` to view and enroll in the events created by the Admin.
