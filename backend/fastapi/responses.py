import flask

class JSONResponse:
    def __init__(self, content, status_code=200):
        self.content = content
        self.status_code = status_code

    def unwrap(self):
        return flask.make_response(flask.jsonify(self.content), self.status_code)

class StreamingResponse:
    def __init__(self, content, status_code=200, media_type=None, headers=None):
        self.content = content
        self.status_code = status_code
        self.media_type = media_type
        self.headers = headers or {}

    def unwrap(self):
        res = flask.Response(self.content, status=self.status_code, mimetype=self.media_type)
        for k, v in self.headers.items():
            res.headers[k] = v
        return res
