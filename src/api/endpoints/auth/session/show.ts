/**
 * Module dependencies
 */
import $ from 'cafy';
import AuthSess from '../../../models/auth-session';
import { pack } from '../../../models/auth-session';

/**
 * @swagger
 * /auth/session/show:
 *   post:
 *     summary: Show a session information
 *     parameters:
 *       -
 *         name: token
 *         description: Session Token
 *         in: formData
 *         required: true
 *         type: string
 *
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: object
 *           properties:
 *             created_at:
 *               type: string
 *               format: date-time
 *               description: Date and time of the session creation
 *             app_id:
 *               type: string
 *               description: Application ID
 *             token:
 *               type: string
 *               description: Session Token
 *             user_id:
 *               type: string
 *               description: ID of user who create the session
 *             app:
 *               $ref: "#/definitions/Application"
 *       default:
 *         description: Failed
 *         schema:
 *           $ref: "#/definitions/Error"
 */

/**
 * Show a session
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'token' parameter
	const [token, tokenErr] = $(params.token).string().$;
	if (tokenErr) return rej('invalid token param');

	// Lookup session
	const session = await AuthSess.findOne({
		token: token
	});

	if (session == null) {
		return rej('session not found');
	}

	// Response
	res(await pack(session, user));
});
