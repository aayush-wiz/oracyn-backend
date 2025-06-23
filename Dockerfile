FROM node:20-bookworm

# THIS IS THE KEY FIX:
# Create the shared directory that will be used for volume mounts
# and ensure the non-root 'node' user owns it.
RUN mkdir -p /shared/uploads && chown -R node:node /shared

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and give the 'node' user ownership
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm install

# Copy the Prisma schema
COPY --chown=node:node prisma ./prisma/

# Generate the Prisma client
RUN npx prisma generate

# Copy the rest of the application code
COPY --chown=node:node . .

# Expose the port
EXPOSE 3000

# The command to start the server with hot-reloading (from your package.json)
CMD [ "npm", "run", "dev" ]