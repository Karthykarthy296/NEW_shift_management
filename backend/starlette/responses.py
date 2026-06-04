import flask

class Response:
    def __init__(self, content=None, status_code=200, headers=None, media_type=None):
        self.content = content
        self.status_code = status_code
        self.headers = headers or {}
        self.media_type = media_type

    def unwrap(self):
        res = flask.Response(self.content, status=self.status_code, mimetype=self.media_type)
        for k, v in self.headers.items():
            res.headers[k] = v
        return res
