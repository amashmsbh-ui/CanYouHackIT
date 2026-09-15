# CanYouHackIT

We are basically working on ending the offline bus system managed in our college campus and converting it to completely ONLINE platform where a student now doesn't have to stand in long queues , struggle with cash payment and running to **LHTC** and Admin block in in Rainy , Hot sunny or cold windy weather ;

## Features
- **Student Portal**: Book tickets, manage wallet, view live transit updates.
- **Admin Dashboard**: Manage bus fleets, driver assignments, and student balances.
- **Conductor Mode**: Real-time ticket scanning via QR code.
- **Secure Authentication**: JWT-based login with role-based access control.
- **Real-time Updates**: Socket.io integration for instant boarding updates and notifications.

## Technologies Used
- Node.js, Express.js
- Prisma ORM, PostgreSQL
- Socket.io
- Tailwind CSS, HTML5, Vanilla JS

## Local Development

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Setup
1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd CanYouHackIT
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   Copy `.env.example` to `.env` and fill in your credentials (including database URL and Razorpay keys).
   ```bash
   cp .env.example .env
   ```
4. Initialize the database:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Docker Deployment

This project includes a `Dockerfile` for easy deployment using Docker.

1. Build the Docker image:
   ```bash
   docker build -t smart-transit-app .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 --env-file .env smart-transit-app
   ```

Make sure your PostgreSQL database is reachable from inside the Docker container (e.g., using a managed database service or Docker Compose).