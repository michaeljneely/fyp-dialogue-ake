export const grants = {
    user: {
        account: {
            "create:own": ["*"],
            "read:own": ["*"],
            "update:own": ["*"],
            "delete:own": ["*"]
        }
    }
};

export type Role = "admin" | "user";