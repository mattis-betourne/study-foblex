# StudyFoblex

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Documentation technique

### Pattern Strategy pour la gestion des nœuds temporaires

Pour comprendre l'architecture et le fonctionnement du système de création des nœuds temporaires lors du drag & drop, consultez la [documentation détaillée du pattern Strategy](src/app/docs/temporary-nodes-strategy-pattern.md).

Cette documentation explique :
- L'architecture générale du pattern Strategy utilisé
- Comment fonctionne le système de nœuds temporaires
- Comment ajouter de nouveaux types de nœuds avec des règles spécifiques
- Les bonnes pratiques pour maintenir et étendre le système
