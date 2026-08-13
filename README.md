# jace-s

`jace-s` is a personal web hub built with Next.js. It brings together personal content, projects, comments, external service integrations, and real-time collaboration features in one web application.

## Requirements

- Node.js 20 or later
- npm
- Docker, when using the container workflows
- Access to the required external services and Oracle database for server-side features

Runtime and deployment environment files are managed outside Git. Do not commit environment files, credentials, or other secret values.

## Local development

Run commands from the project root, where `package.json` is located.

```bash
npm ci
npm run dev
```

The default development server is available at [http://localhost:3000](http://localhost:3000). The `dev` script starts the custom server, which combines Next.js with the WebSocket server.

To run only the standard Next.js development server:

```bash
npm run dev:next
```

The development environment files required by the application are provided separately and must not be added to the repository.

## Validation

```bash
npm run type-check
npm run lint
npm run build
```

The repository currently does not include a unit or integration test runner. External-service and database checks require their corresponding services and configuration.

## Docker

The Dockerfile provides development and production build targets. The Docker helper script reads the selected environment file outside Git and passes the required build-time settings to Docker.

### Development image

```bash
npm run docker:build:dev
npm run docker:run:dev
```

Or build and run in one step:

```bash
npm run docker:build:run:dev
```

### Production image

```bash
npm run docker:build:prod
npm run docker:run:prod
```

Or build and run in one step:

```bash
npm run docker:build:run:prod
```

Container cleanup commands are available for both environments:

```bash
npm run docker:clean:dev
npm run docker:clean:prod
```

## Deployment

The deployment workflow is defined in `.github/workflows/deploy.yml`.

Pushing to the configured production branch runs the following checks and deployment steps:

1. Install dependencies with `npm ci`.
2. Run ESLint and TypeScript validation.
3. Build and push the Docker image to Amazon ECR.
4. Register an updated ECS task definition.
5. Update the ECS service and wait for stabilization.

Production deployment should be performed through the approved CI workflow. Do not commit deployment credentials or production environment files.

## Project structure

- `app/`: Next.js pages, route handlers, components, hooks, services, and utilities
- `public/`: static assets
- `scripts/`: build and deployment helpers
- `server.ts`: custom HTTP and WebSocket server
- `Dockerfile`: development and production container builds
- `nginx/`: container reverse-proxy configuration
- `.github/workflows/`: CI and deployment workflows

## Development notes

- Preserve the existing TypeScript strictness and component patterns.
- Keep server-only credentials and environment values outside Git.
- Validate changes with type-checking, linting, and a production build before committing.
- Keep unrelated refactoring and deployment changes out of feature commits.
