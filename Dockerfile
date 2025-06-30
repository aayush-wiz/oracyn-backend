# ---- STAGE 1: The Builder ----
# This stage installs ALL dependencies, builds the Prisma client, and then
# removes development packages to create a clean production-ready directory.
FROM node:20-bullseye-slim AS builder

WORKDIR /usr/src/app

# First, copy the package files and the schema
COPY package*.json ./
COPY prisma/ ./prisma/

# Install ALL dependencies (including devDependencies like 'prisma')
# This is necessary to be able to run `npx prisma generate`
RUN npm install

# Copy the rest of the application source code
COPY . .

# Generate the Prisma client. This uses the schema and creates files in node_modules
RUN npx prisma generate

# IMPORTANT: After we are done with all build steps, we now "prune" the
# devDependencies from the node_modules folder. This leaves us with a clean
# set of production-only packages AND the generated Prisma Client.
RUN npm prune --omit=dev


# ---- STAGE 2: The Production Runner ----
# This is the final, lean image that will run the application.
FROM node:20-bullseye-slim

WORKDIR /usr/src/app

# Set ownership of the working directory for the existing 'node' user
RUN chown node:node .
# Switch to the non-root 'node' user for security
USER node

# Copy the pre-built, production-ready application from the builder stage.
# This includes the source code, prisma schema, AND the pruned node_modules folder
# with the generated client inside.
COPY --chown=node:node --from=builder /usr/src/app ./

EXPOSE 3000

# This command will now succeed because the `prisma` directory containing
# schema.prisma was correctly copied from the builder stage.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start"]