# 1. Use a more complete base image that includes necessary system libraries
FROM node:20-bookworm

# 2. Set working directory in the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy Prisma schema
COPY prisma ./prisma/

# 6. Generate Prisma Client
RUN npx prisma generate

# 7. Copy the rest of your application's source code
COPY . .

# 8. Expose the port the app runs on
EXPOSE 3000

# 9. Command to run the application
CMD ["npm", "start"]