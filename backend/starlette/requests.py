import flask

class Request:
    def __init__(self, flask_req=None):
        self._req = flask_req or flask.request

    @property
    def url(self):
        return type('URL', (), {'path': self._req.path})()

    @property
    def method(self):
        return self._req.method

    @property
    def headers(self):
        return self._req.headers

    @property
    def client(self):
        return type('Client', (), {'host': self._req.remote_addr})()
