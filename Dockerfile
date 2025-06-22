FROM node:20-bookworm

# Set the working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies securely during the build
RUN npm install

# Copy the Prisma schema
COPY prisma ./prisma/

# Generate the Prisma client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 3000

# This is the ONLY command that runs on startup now.
CMD [ "npm", "run", "start" ]