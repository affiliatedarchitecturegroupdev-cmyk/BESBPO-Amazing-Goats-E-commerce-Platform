import { Route } from './routes.types';

/** Persistence boundary for routes; the SQL adapter lands with the logistics store swap. */
export interface RouteStore {
  list(): Promise<Route[]>;
  get(id: string): Promise<Route | undefined>;
  insert(route: Route): Promise<Route>;
}

/** In-memory route store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryRouteStore implements RouteStore {
  private readonly byId = new Map<string, Route>();

  constructor(seed: Route[] = []) {
    for (const route of seed) this.byId.set(route.id, route);
  }

  async list(): Promise<Route[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Route | undefined> {
    return this.byId.get(id);
  }

  async insert(route: Route): Promise<Route> {
    this.byId.set(route.id, route);
    return route;
  }
}
