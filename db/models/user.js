"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.ConversationMember, {
        foreignKey: "user_id",
        as: "conversationMembers",
      });

      User.hasMany(models.ConversationKey, {
        foreignKey: "user_id",
        as: "conversationKeys",
      });

      User.hasMany(models.Message, {
        foreignKey: "sender_id",
        as: "sentMessages",
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },

      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      public_key: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      encrypted_private_key: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      key_derivation_salt: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      underscored: true,
      timestamps: true,
    }
  );

  return User;
};