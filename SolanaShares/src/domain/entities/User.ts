export class User {
  constructor(
    public readonly userId: string,
    public readonly username: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(userId: string, username: string): User {
    return new User(userId, username);
  }

  updateUsername(newUsername: string): User {
    return new User(
      this.userId,
      newUsername,
      this.createdAt,
      new Date()
    );
  }
}