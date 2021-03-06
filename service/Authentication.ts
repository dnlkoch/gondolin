import logger from '../config/logger';
import * as passport from 'passport';
import * as jwt from 'jsonwebtoken';
import * as express from 'express';
import SecurityUtil from '../util/SecurityUtil';
import User from '../models/User';

import {
  StrategyOptions,
  ExtractJwt,
  Strategy as JwtStrategy
} from 'passport-jwt';

import secretOrKey from '../config/passport';

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey
};

// TODO Move to seperate File
export const jwtStrategy = new JwtStrategy(jwtOptions, (jwtPayload, next) => {
  User.findOne({
    where: {
      id: jwtPayload.id
    }
  })
  .then(user => {
    if (user) {
        next(null, user);
      } else {
        next(null, false);
      }
    });
});

/**
 * The AuthenticationService provides functionality to login and logout users.
 *
 * @class AuthenticationService
 */
export default class AuthenticationService {

  /**
   * Creates an instance of AuthenticationService.
   *
   * @param {ExpressApp} app
   * @memberof AuthenticationService
   */
  constructor(app: express.Application) {
    passport.use(jwtStrategy);
    app.use(passport.initialize());
  }

  /**
   * Login a user by name and password.
   *
   * @param {string} inputName
   * @param {string} inputPassword
   * @return {object} Returnobject in form {
   *  success: {boolean},
   *  message: {string},
   *  token: {JWT}
   * }
   * @memberof AuthenticationService
   * @async
   */
  async login(inputName: string, inputPassword: string) {
    logger.info('User is trying to login.');

    return User.scope('withPassword').findOne({
      where: {
        username: inputName
      }
    })
      .then((user) => {
        if (!user) {
          logger.info('Login failed. No such user.');
          return {
            success: false,
            message: "No such user."
          };
        }

        const {
          id,
          username,
          password
        } = user;

        if (SecurityUtil.comparePassword(inputPassword, password)) {
          logger.info('User logged in.');

          const payload = {
            id,
            username
          };

          const token = jwt.sign(payload, jwtOptions.secretOrKey as jwt.Secret);
          return {
            success: true,
            message: "User logged in.",
            token
          };
        } else {
          logger.info('Login failed. wrong password.');
          return {
            success: false,
            message: "Password did not match."
          };
        }
      });
  }

  /**
   * Register a new user from a userdata object.
   *
   * @param {object} userData An object that can contain all properties of User
   * and Manager.
   * @return {object} Returnobject in form {
   *  success: {boolean},
   *  message: {string},
   *  user: {User}
   * }
   * @memberof AuthenticationService
   * @async
   */
  async register(userData) {
    const {
      username,
      password,
      details,
      clientConfig
    } = userData;

    logger.debug(`Registering user ${username}.`);

    const hashedPassword = SecurityUtil.generateHash(password);

    return User.create({
        username,
        password: hashedPassword,
        details,
        clientConfig
      })
        .then((user: User) => {
          if (user) {
            return {
              success: true,
              message: "Registration completed.",
              user
            };
          } else {
            logger.warn('Registration failed.');
            return {
              success: false,
              message: "Registration failed."
            };
          }
        })
        .catch(error => {
          logger.error(`Could not register user: ${error}.`);
          throw error;
        });
  }
}

/**
 * Middleware to be used with express interfaces. e.g.
 *   app.get('/mySecuredInterface', jwtMiddleWare, (req, res) => {});
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
export const jwtMiddleWare = passport.authenticate('jwt', {
  session: false
});
