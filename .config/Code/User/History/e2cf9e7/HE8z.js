export class UserStore {
  constructor() {
    this.users = new Map();
  }

  setUser(userId, userData) {
    this.users.set(userId, { 
      ...this.getUser(userId),
      ...userData,
      updatedAt: new Date()
    });
  }

  getUser(userId) {
    return this.users.get(userId) || {
      id: userId,
      role: null,
      knowledgeLevel: null,
      testAnswers: [],
      state: 'start',
      createdAt: new Date()
    };
  }

  updateUserState(userId, state) {
    const user = this.getUser(userId);
    user.state = state;
    this.setUser(userId, user);
  }
}

export const userStore = new UserStore();
