export interface Person {
  _id: string;
  username: string;
  color?: string;
}

export interface Account extends Person {
  color: string;
  phoneNumber: string | null;
  requiresPhone: boolean;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface Registration extends Credentials {
  email: string;
  phoneNumber: string;
}
